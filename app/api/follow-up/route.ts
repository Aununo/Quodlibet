import { NextRequest, NextResponse } from "next/server";
import {
  getClient,
  callJSON,
  describeError,
  streamTextResponse,
} from "@/lib/claude";
import {
  FIRST_ROUND_SYSTEM,
  FOLLOW_UP_SYSTEM,
  firstRoundUserPrompt,
  followUpUserPrompt,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-anthropic-key") ?? "";
    const baseURL = req.headers.get("x-anthropic-base-url") ?? "";
    const model = req.headers.get("x-anthropic-model") ?? "";
    const {
      category,
      question,
      referencePoints,
      userAnswer,
      includeEvaluation,
      spokenDurationSec,
    } = await req.json();
    if (!question || !userAnswer) {
      return NextResponse.json(
        { error: "缺少 question 或 userAnswer" },
        { status: 400 },
      );
    }
    const client = getClient(apiKey, baseURL);
    if (includeEvaluation) {
      return streamTextResponse(
        client,
        FIRST_ROUND_SYSTEM,
        firstRoundUserPrompt(
          category ?? "",
          question,
          referencePoints ?? [],
          userAnswer,
          spokenDurationSec,
        ),
        1800,
        model || undefined,
      );
    }

    const result = await callJSON<{ follow_up: string }>(
      client,
      FOLLOW_UP_SYSTEM,
      followUpUserPrompt(
        category ?? "",
        question,
        referencePoints ?? [],
        userAnswer,
      ),
      1200,
      model || undefined,
    );
    return NextResponse.json(result);
  } catch (e: any) {
    const { error, upstreamStatus } = describeError(e);
    return NextResponse.json({ error }, { status: upstreamStatus ?? 500 });
  }
}
