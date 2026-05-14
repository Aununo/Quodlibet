import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";

export const DEFAULT_MODEL = "claude-sonnet-4-6";
const encoder = new TextEncoder();

export function getClient(apiKey: string, baseURL?: string) {
  if (!apiKey) {
    throw new Error("缺少 API key");
  }
  const opts: ConstructorParameters<typeof Anthropic>[0] = { apiKey };
  if (baseURL && /^https?:\/\//i.test(baseURL)) {
    opts.baseURL = baseURL.replace(/\/+$/, "");
  }
  return new Anthropic(opts);
}

export async function callJSON<T>(
  client: Anthropic,
  system: string,
  user: string | ContentBlockParam[],
  maxTokens = 2048,
  model = DEFAULT_MODEL,
): Promise<T> {
  const createMessage = (tokenBudget: number) =>
    client.messages.create({
      model,
      max_tokens: tokenBudget,
      system,
      messages: [{ role: "user", content: user }],
    });

  let resp = await createMessage(maxTokens);
  let raw = textFromContent(resp.content);
  if (!raw && hasContentType(resp.content, "thinking") && maxTokens < 1600) {
    resp = await createMessage(1600);
    raw = textFromContent(resp.content);
  }
  if (!raw) {
    const types = contentTypes(resp.content);
    const hint = hasContentType(resp.content, "thinking")
      ? "；上游只返回了思考内容，可能是 max_tokens 不足或 relay 开启了 thinking"
      : "";
    throw new Error(`Claude 没有返回文本内容（content types: ${types}${hint}）`);
  }
  const cleaned = cleanJSONText(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(`Claude 返回非合法 JSON：${cleaned.slice(0, 200)}`);
  }
}

function textFromContent(content: Array<{ type: string; text?: string }>) {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("")
    .trim();
}

function hasContentType(content: Array<{ type: string }>, type: string) {
  return content.some((block) => block.type === type);
}

function contentTypes(content: Array<{ type: string }>) {
  return content.map((b) => b.type).join(", ") || "empty";
}

export function cleanJSONText(raw: string) {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function streamTextResponse(
  client: Anthropic,
  system: string,
  user: string | ContentBlockParam[],
  maxTokens = 2048,
  model = DEFAULT_MODEL,
  fallback?:
    | StreamFallback
    | StreamFallback[],
) {
  const body = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const runStream = async (
        content: string | ContentBlockParam[],
        tokenBudget = maxTokens,
        retriedForTruncation = false,
      ) => {
        let fullText = "";
        let thinkingChars = 0;
        let stopReason: string | null = null;
        const seenTypes = new Set<string>();
        const t0 = Date.now();
        let firstByteAt: number | null = null;
        let firstTextAt: number | null = null;
        console.log(`[stream] start model=${model} tokenBudget=${tokenBudget}`);
        const stream = client.messages.stream({
          model,
          max_tokens: tokenBudget,
          system,
          messages: [{ role: "user", content }],
        });

        for await (const event of stream) {
          if (firstByteAt === null) {
            firstByteAt = Date.now();
            console.log(`[stream] first event +${firstByteAt - t0}ms type=${event.type}`);
          }
          if (
            event.type === "content_block_start" &&
            "content_block" in event &&
            typeof event.content_block.type === "string"
          ) {
            seenTypes.add(event.content_block.type);
          }
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            if (firstTextAt === null) {
              firstTextAt = Date.now();
              console.log(`[stream] first text +${firstTextAt - t0}ms (thinking chars so far: ${thinkingChars})`);
            }
            seenTypes.add("text");
            fullText += event.delta.text;
            send("delta", { text: event.delta.text });
          }
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "thinking_delta"
          ) {
            seenTypes.add("thinking");
            const chunk = (event.delta as { thinking?: string }).thinking ?? "";
            thinkingChars += chunk.length;
            send("thinking", { chars: thinkingChars });
          }
          if (
            event.type === "message_delta" &&
            "delta" in event &&
            typeof (event.delta as { stop_reason?: string }).stop_reason === "string"
          ) {
            stopReason = (event.delta as { stop_reason: string }).stop_reason;
          }
        }
        console.log(`[stream] done +${Date.now() - t0}ms textLen=${fullText.length} stop=${stopReason} types=${Array.from(seenTypes).join(",")}`);

        const cleaned = cleanJSONText(fullText);
        const truncated = stopReason === "max_tokens";

        if (!cleaned || truncated) {
          if (!retriedForTruncation && (truncated || seenTypes.has("thinking"))) {
            send("notice", {
              text: truncated
                ? `上次输出在 max_tokens 处被截断，正在用更大预算重试...`
                : `上游只返回思考内容，正在用更大预算重试...`,
            });
            await runStream(
              content,
              Math.max(tokenBudget * 2, 6000),
              true,
            );
            return;
          }
          if (!cleaned) {
            const types = Array.from(seenTypes).join(", ") || "empty";
            const hint = seenTypes.has("thinking")
              ? "；上游只返回了思考内容，可能是 max_tokens 不足或 relay 开启了 thinking"
              : "";
            throw new Error(
              `Claude 没有返回文本内容（content types: ${types}${hint}）`,
            );
          }
          throw new Error(
            `Claude 输出被截断（stop_reason=${stopReason}），重试后仍未完成。请减少题量或调大模型预算。`,
          );
        }

        send("done", { text: cleaned });
      };

      const fallbacks = Array.isArray(fallback)
        ? fallback
        : fallback
          ? [fallback]
          : [];
      const attempts = [{ user }, ...fallbacks];
      try {
        for (let i = 0; i < attempts.length; i += 1) {
          const attempt = attempts[i];
          try {
            await runStream(attempt.user);
            return;
          } catch (e: any) {
            const next = fallbacks
              .slice(i)
              .find((candidate) => candidate.shouldFallback(e));
            if (!next) {
              send("error", describeError(e));
              return;
            }
            send("notice", { text: next.message });
            const nextIndex = attempts.indexOf(next);
            if (nextIndex > i) {
              i = nextIndex - 1;
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

interface StreamFallback {
  user: string | ContentBlockParam[];
  message: string;
  shouldFallback: (e: any) => boolean;
}

export function describeError(e: any): { error: string; upstreamStatus?: number } {
  if (e && typeof e.status === "number") {
    const body = e.error;
    const inner =
      body?.error?.message ??
      body?.message ??
      (typeof body === "string" ? body : undefined) ??
      e.message;
    const param = body?.error?.param ?? body?.param;
    const code = body?.error?.type ?? body?.error?.code ?? body?.type;
    const codePart = code ? ` [${code}]` : "";
    const paramPart = param ? `（${param}）` : "";
    return {
      error: `上游 ${e.status}${codePart}: ${inner}${paramPart}`,
      upstreamStatus: e.status,
    };
  }
  if (e?.code === "ENOTFOUND" || e?.code === "ECONNREFUSED") {
    return { error: `网络无法到达上游：${e.code}（请检查 Base URL）` };
  }
  return { error: e?.message ?? "未知错误" };
}
