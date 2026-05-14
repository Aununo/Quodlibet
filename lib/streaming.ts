import type { EvalResult, Question } from "@/lib/types";

export function apiHeaders(apiKey: string, baseUrl: string, model: string) {
  return {
    "content-type": "application/json",
    "x-anthropic-key": apiKey,
    "x-anthropic-base-url": baseUrl,
    "x-anthropic-model": model,
  };
}

export async function postEventStream<T>({
  url,
  headers,
  body,
  onDelta,
  onNotice,
  onThinking,
}: {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  onDelta?: (text: string) => void;
  onNotice?: (text: string) => void;
  onThinking?: (chars: number) => void;
}): Promise<{ text: string; json?: T }> {
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const contentType = r.headers.get("content-type") ?? "";

  if (!r.ok) {
    const payload = contentType.includes("application/json")
      ? await r.json()
      : { error: await r.text() };
    throw new Error(payload.error || `请求失败：${r.status}`);
  }

  if (!contentType.includes("text/event-stream") || !r.body) {
    const json = (await r.json()) as T;
    return { text: JSON.stringify(json), json };
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";

  const dispatch = (block: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    const data = JSON.parse(dataLines.join("\n"));
    if (event === "delta") onDelta?.(data.text ?? "");
    if (event === "notice") onNotice?.(data.text ?? "");
    if (event === "thinking") onThinking?.(Number(data.chars) || 0);
    if (event === "done") finalText = data.text ?? "";
    if (event === "error") throw new Error(data.error ?? "流式请求失败");
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      dispatch(block);
      boundary = buffer.indexOf("\n\n");
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) dispatch(buffer);

  return { text: finalText };
}

export function parseJSON<T>(raw: string): T {
  const cleaned = cleanJSONText(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Claude 返回非合法 JSON：${cleaned.slice(0, 200)}`);
  }
}

export function cleanJSONText(raw: string) {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function normalizeQuestion(q: Question, id: number): Question {
  return {
    id,
    category: q.category || "技术派",
    question: q.question || "",
    reference_points: Array.isArray(q.reference_points) ? q.reference_points : [],
  };
}

export function normalizeEval(value: unknown): EvalResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<EvalResult>;
  const score = Number(raw.score);
  if (!Number.isFinite(score)) return undefined;
  return {
    score: Math.min(Math.max(Math.round(score), 0), 10),
    highlights: Array.isArray(raw.highlights)
      ? raw.highlights.map(String).filter(Boolean)
      : [],
    gaps: Array.isArray(raw.gaps) ? raw.gaps.map(String).filter(Boolean) : [],
    improved_answer:
      typeof raw.improved_answer === "string" ? raw.improved_answer : "",
  };
}

function unescapeJSONString(s: string) {
  return s.replace(/\\(["\\/bfnrt])/g, (_, c) => {
    if (c === "n") return "\n";
    if (c === "t") return "\t";
    if (c === "r") return "\r";
    if (c === "b") return "\b";
    if (c === "f") return "\f";
    return c;
  });
}

export function extractStreamingQuestion(raw: string): Question | null {
  const text = cleanJSONText(raw);
  const arrayKey = text.indexOf('"questions"');
  const arrayStart = text.indexOf("[", arrayKey >= 0 ? arrayKey : 0);
  if (arrayStart < 0) return null;
  const objStart = text.indexOf("{", arrayStart);
  if (objStart < 0) return null;
  const slice = text.slice(objStart);

  const idMatch = /"id"\s*:\s*(\d+)/.exec(slice);
  const id = idMatch ? parseInt(idMatch[1], 10) : 0;

  const categoryMatch = /"category"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(slice);
  const category = categoryMatch ? unescapeJSONString(categoryMatch[1]) : "";

  const questionMatch = /"question"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(slice);
  if (!questionMatch) return null;
  const question = unescapeJSONString(questionMatch[1]);
  if (!question) return null;

  const referencePoints: string[] = [];
  const refIdx = slice.indexOf('"reference_points"');
  if (refIdx >= 0) {
    const bracketIdx = slice.indexOf("[", refIdx);
    if (bracketIdx >= 0) {
      const refSlice = slice.slice(bracketIdx + 1);
      const stringRe = /"((?:[^"\\]|\\.)*)"/g;
      let m: RegExpExecArray | null;
      while ((m = stringRe.exec(refSlice)) !== null) {
        referencePoints.push(unescapeJSONString(m[1]));
      }
    }
  }

  return { id, category, question, reference_points: referencePoints };
}

export function humanizeStreamingJSON(raw: string) {
  return cleanJSONText(raw)
    .replace(/^\{/, "")
    .replace(/\}?$/, "")
    .replace(/"score"\s*:\s*/g, "评分：")
    .replace(/"highlights"\s*:\s*\[/g, "\n亮点：")
    .replace(/"gaps"\s*:\s*\[/g, "\n待改进：")
    .replace(/"improved_answer"\s*:\s*/g, "\n示范回答：")
    .replace(/[{}\[\]",]/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
