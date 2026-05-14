import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { callJSON, getClient, describeError, streamTextResponse } from "@/lib/claude";
import {
  DECK_SUMMARY_SYSTEM,
  QUESTION_GEN_SYSTEM,
  deckSummaryUserPrompt,
  questionGenUserPrompt,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Question {
  id: number;
  category: string;
  question: string;
  reference_points: string[];
}

const DIRECT_TEXT_LIMIT = 30000;
const SUMMARY_CHUNK_SIZE = 9000;
const MAX_SUMMARY_CHUNKS = 6;
const PERSONAS = ["技术派", "产品派", "创新派", "工程派", "刁钻派"];
const MAX_SUMMARY_CACHE_ENTRIES = 20;
const summaryCache = new Map<string, Promise<string>>();

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-anthropic-key") ?? "";
    const baseURL = req.headers.get("x-anthropic-base-url") ?? "";
    const model = req.headers.get("x-anthropic-model") ?? "";
    const { deckText, n, personas, previousQuestions, nextId } =
      await req.json();
    const sourceDeckText = typeof deckText === "string" ? deckText : "";
    if (!sourceDeckText) {
      return NextResponse.json({ error: "缺少 deckText" }, { status: 400 });
    }
    const count = Math.min(Math.max(Number(n) || 5, 1), 10);
    const enabledPersonas = normalizePersonas(personas);
    const client = getClient(apiKey, baseURL);
    const deckPromptText = await buildDeckPromptText(
      client,
      sourceDeckText,
      model || undefined,
    );
    const previous = normalizePreviousQuestions(previousQuestions);
    const id = normalizeNextId(nextId);
    const textOnlyContent = buildQuestionContent(
      deckPromptText,
      count,
      enabledPersonas,
      previous,
      id,
    );
    const textOnlyContentNoCache = buildQuestionContent(
      deckPromptText,
      count,
      enabledPersonas,
      previous,
      id,
      false,
    );
    return streamTextResponse(
      client,
      QUESTION_GEN_SYSTEM,
      textOnlyContent,
      8000,
      model || undefined,
      [
        {
          user: textOnlyContentNoCache,
          message: "当前上游不支持 prompt cache，已自动改用普通请求。",
          shouldFallback: isPromptCacheUnsupported,
        },
      ],
    );
  } catch (e: any) {
    const { error, upstreamStatus } = describeError(e);
    return NextResponse.json({ error }, { status: upstreamStatus ?? 500 });
  }
}

function isPromptCacheUnsupported(e: any) {
  const message = [
    e?.message,
    e?.error?.message,
    e?.error?.error?.message,
    e?.body,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    message.includes("cache_control") ||
    message.includes("prompt cache") ||
    message.includes("prompt caching")
  );
}

async function buildDeckPromptText(
  client: ReturnType<typeof getClient>,
  deckText: string,
  model?: string,
) {
  if (deckText.length <= DIRECT_TEXT_LIMIT) {
    return deckText;
  }

  const cacheKey = createSummaryCacheKey(deckText, model);
  const cached = summaryCache.get(cacheKey);
  if (cached) return cached;

  const promise = summarizeLongDeck(client, deckText, model).catch((error) => {
    summaryCache.delete(cacheKey);
    throw error;
  });
  summaryCache.set(cacheKey, promise);
  trimSummaryCache();
  return promise;
}

async function summarizeLongDeck(
  client: ReturnType<typeof getClient>,
  deckText: string,
  model?: string,
) {
  const chunks = chunkText(deckText, SUMMARY_CHUNK_SIZE).slice(0, MAX_SUMMARY_CHUNKS);
  const settled = await Promise.allSettled(
    chunks.map((chunk, index) =>
      callJSON<{ summary: string }>(
        client,
        DECK_SUMMARY_SYSTEM,
        deckSummaryUserPrompt(chunk, index + 1, chunks.length),
        500,
        model,
      ).then((r) => r.summary.trim()),
    ),
  );
  const summaries = settled
    .map((result) => (result.status === "fulfilled" ? result.value : ""))
    .filter(Boolean);

  if (!summaries.length) {
    return `【PPT 原文节选：长 deck 摘要暂不可用，已自动退回节选模式】
${deckText.slice(0, DIRECT_TEXT_LIMIT)}`;
  }

  return `【PPT 长文提纲，来自 ${chunks.length} 个分块摘要】
${summaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}

【PPT 前部原文节选】
${deckText.slice(0, 6000)}`;
}

function createSummaryCacheKey(deckText: string, model?: string) {
  return createHash("sha256")
    .update(model ?? "")
    .update("\0")
    .update(deckText)
    .digest("hex");
}

function trimSummaryCache() {
  while (summaryCache.size > MAX_SUMMARY_CACHE_ENTRIES) {
    const oldestKey = summaryCache.keys().next().value;
    if (!oldestKey) return;
    summaryCache.delete(oldestKey);
  }
}

function chunkText(text: string, size: number) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function normalizePersonas(value: unknown) {
  if (!Array.isArray(value)) return PERSONAS;
  const filtered = value
    .filter((p): p is string => typeof p === "string")
    .filter((p) => PERSONAS.includes(p));
  return filtered.length ? filtered : PERSONAS;
}

function normalizePreviousQuestions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((q) => {
      if (typeof q === "string") return q;
      if (q && typeof q === "object" && "question" in q) {
        return String(q.question ?? "");
      }
      return "";
    })
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeNextId(value: unknown) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? Math.round(id) : 1;
}

function buildQuestionContent(
  deckText: string,
  count: number,
  personas: string[],
  previousQuestions: string[] = [],
  nextId = 1,
  usePromptCache = true,
): ContentBlockParam[] {
  const content: ContentBlockParam[] = [
    {
      type: "text",
      text: `<ppt>\n${deckText}\n</ppt>`,
    },
  ];

  if (usePromptCache && content.length > 0) {
    content[content.length - 1] = withCacheControl(content[content.length - 1]);
  }

  content.push({
    type: "text",
    text: questionGenUserPrompt(
      count,
      personas,
      previousQuestions,
      nextId,
    ),
  });

  return content;
}

function withCacheControl(block: ContentBlockParam): ContentBlockParam {
  return {
    ...block,
    cache_control: { type: "ephemeral" },
  } as ContentBlockParam;
}
