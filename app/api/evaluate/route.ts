import { NextRequest, NextResponse } from "next/server";
import { getClient, describeError, streamTextResponse } from "@/lib/claude";
import { EVAL_SYSTEM, evalUserPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

interface EvalResult {
  score: number;
  highlights: string[];
  gaps: string[];
  improved_answer: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-anthropic-key") ?? "";
    const baseURL = req.headers.get("x-anthropic-base-url") ?? "";
    const model = req.headers.get("x-anthropic-model") ?? "";
    const {
      question,
      referencePoints,
      userAnswer,
      followUp,
      userAnswerFollowUp,
      spokenDurationSec,
    } = await req.json();
    if (!question || !userAnswer) {
      return NextResponse.json(
        { error: "缺少 question 或 userAnswer" },
        { status: 400 },
      );
    }
    const client = getClient(apiKey, baseURL);
    return streamTextResponse(
      client,
      EVAL_SYSTEM,
      evalUserPrompt(
        question,
        referencePoints ?? [],
        userAnswer,
        followUp,
        userAnswerFollowUp,
        spokenDurationSec,
      ),
      1200,
      model || undefined,
    );
  } catch (e: any) {
    const { error, upstreamStatus } = describeError(e);
    return NextResponse.json({ error }, { status: upstreamStatus ?? 500 });
  }
}
