"use client";

import { useEffect, useRef, useState } from "react";
import { parsePptx } from "@/lib/pptx-parser";
import {
  BASE_URL_STORAGE,
  C,
  DEFAULT_MODEL,
  KEY_STORAGE,
  MODEL_STORAGE,
  PERSONAS,
  PERSONAS_STORAGE,
  QUESTION_COUNT_STORAGE,
} from "@/lib/constants";
import type {
  EvalResult,
  FirstRoundResult,
  Phase,
  PrefetchedQuestion,
  Question,
} from "@/lib/types";
import {
  apiHeaders,
  extractStreamingQuestion,
  normalizeEval,
  normalizeQuestion,
  parseJSON,
  postEventStream,
} from "@/lib/streaming";
import { avgScore, buildExportMarkdown, withoutKey } from "@/lib/export";
import { TopBar } from "@/components/TopBar";
import { WelcomeCard } from "@/components/WelcomeCard";
import { CenterAction } from "@/components/CenterAction";
import { LoadingProgress } from "@/components/LoadingProgress";
import {
  EvalContent,
  EvalDraftBubble,
  FollowUpBubble,
  JudgeBubble,
  SystemBubble,
  UserBubble,
} from "@/components/Bubbles";
import { InputDock } from "@/components/InputDock";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { primaryBtn, refToggleBtn, scoreColor, secondaryBtn } from "@/components/ui";

export default function Page() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [questionCount, setQuestionCount] = useState(5);
  const [personas, setPersonas] = useState<string[]>(PERSONAS);
  const [deckText, setDeckText] = useState("");
  const [slideCount, setSlideCount] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [cursor, setCursor] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [followUps, setFollowUps] = useState<Record<number, string>>({});
  const [answers2, setAnswers2] = useState<Record<number, string>>({});
  const [evals, setEvals] = useState<Record<number, EvalResult>>({});
  const [evalDrafts, setEvalDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [openRef, setOpenRef] = useState<Record<number, boolean>>({});
  const [draftSpeechSeconds, setDraftSpeechSeconds] = useState(0);
  const [thinkingChars, setThinkingChars] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const prefetchRef = useRef<PrefetchedQuestion | null>(null);
  const runIdRef = useRef(0);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const k = localStorage.getItem(KEY_STORAGE);
    if (k) setApiKey(k);
    const b = localStorage.getItem(BASE_URL_STORAGE);
    if (b) setBaseUrl(b);
    const m = localStorage.getItem(MODEL_STORAGE);
    if (m) setModel(m);
    const q = Number(localStorage.getItem(QUESTION_COUNT_STORAGE));
    if (Number.isFinite(q) && q >= 1 && q <= 10) setQuestionCount(q);
    const p = localStorage.getItem(PERSONAS_STORAGE);
    if (p) {
      const parsed = p
        .split(",")
        .map((s) => s.trim())
        .filter((s) => PERSONAS.includes(s));
      if (parsed.length) setPersonas(parsed);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [
    phase,
    cursor,
    questions.length,
    Object.keys(evals).length,
    Object.keys(followUps).length,
    Object.keys(answers2).length,
    Object.keys(evalDrafts).length,
    busy,
  ]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  function saveKey(k: string) {
    setApiKey(k);
    localStorage.setItem(KEY_STORAGE, k);
  }
  function saveBaseUrl(b: string) {
    setBaseUrl(b);
    localStorage.setItem(BASE_URL_STORAGE, b);
  }
  function saveModel(m: string) {
    setModel(m);
    localStorage.setItem(MODEL_STORAGE, m);
  }
  function saveQuestionCount(n: number) {
    const next = Math.min(Math.max(Math.round(n), 1), 10);
    setQuestionCount(next);
    localStorage.setItem(QUESTION_COUNT_STORAGE, String(next));
  }
  function savePersonas(next: string[]) {
    const filtered = next.filter((p) => PERSONAS.includes(p));
    if (!filtered.length) return;
    setPersonas(filtered);
    localStorage.setItem(PERSONAS_STORAGE, filtered.join(","));
  }

  function showTemporaryNotice(text: string) {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setError(text);
    noticeTimerRef.current = setTimeout(() => {
      setError((current) => (current === text ? "" : current));
      noticeTimerRef.current = null;
    }, 3000);
  }

  async function handleUpload(file: File) {
    setError("");
    if (!file.name.toLowerCase().endsWith(".pptx")) {
      setError("仅支持 .pptx 文件");
      return;
    }
    setPhase("parsing");
    setBusy(true);
    resetPrefetch();
    try {
      const buf = await file.arrayBuffer();
      const deck = await parsePptx(buf);
      setDeckText(deck.combinedText);
      setSlideCount(deck.slideCount);
      setPhase("parsed");
    } catch (err: any) {
      setError(err.message);
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }

  async function genQuestions() {
    if (!apiKey) {
      setError("请先在右上 ⚙ 填入 API Key");
      setShowSettings(true);
      return;
    }
    setError("");
    setPhase("generating");
    setBusy(true);
    setQuestions([]);
    setThinkingChars(0);
    resetPrefetch();
    try {
      setEvals({});
      setEvalDrafts({});
      setAnswers({});
      setFollowUps({});
      setAnswers2({});
      setOpenRef({});
      const firstQuestion = await requestNextQuestion([], 1);
      const nextQuestions = [firstQuestion];
      setQuestions(nextQuestions);
      setCursor(0);
      setPhase("qa");
      prefetchNextQuestion(nextQuestions);
    } catch (err: any) {
      setError(err.message);
      setPhase("parsed");
    } finally {
      setBusy(false);
      setBusyMessage("");
    }
  }

  async function requestNextQuestion(
    existingQuestions: Question[],
    nextId: number,
    options: { streamIntoState?: boolean } = {},
  ) {
    const streamIntoState = options.streamIntoState ?? true;
    let streamed = "";
    const result = await postEventStream<{ questions: Question[] }>({
      url: "/api/generate-questions",
      headers: apiHeaders(apiKey, baseUrl, model),
      body: {
        deckText,
        n: 1,
        personas,
        previousQuestions: existingQuestions.map((q) => q.question),
        nextId,
      },
      onNotice: showTemporaryNotice,
      onThinking: streamIntoState ? (chars) => setThinkingChars(chars) : undefined,
      onDelta: (text) => {
        streamed += text;
        if (!streamIntoState) return;
        const partial = extractStreamingQuestion(streamed);
        if (partial?.question) {
          setQuestions([...existingQuestions, normalizeQuestion(partial, nextId)]);
          setCursor(existingQuestions.length);
          setPhase("qa");
        }
      },
    });
    const parsed =
      result.json ?? parseJSON<{ questions: Question[] }>(result.text || streamed);
    const question = parsed.questions?.[0];
    if (!question) throw new Error("Claude 没有返回问题");
    return normalizeQuestion(question, nextId);
  }

  function resetPrefetch() {
    runIdRef.current += 1;
    prefetchRef.current = null;
  }

  function questionPrefetchKey(existingQuestions: Question[], nextId: number) {
    return [
      nextId,
      model,
      baseUrl,
      personas.join(","),
      existingQuestions.map((q) => `${q.id}:${q.question}`).join("\n"),
    ].join("\n---\n");
  }

  function prefetchNextQuestion(existingQuestions: Question[]) {
    if (existingQuestions.length >= questionCount) {
      prefetchRef.current = null;
      return;
    }

    const nextId = existingQuestions.length + 1;
    const key = questionPrefetchKey(existingQuestions, nextId);
    if (prefetchRef.current?.key === key) return;

    const runId = runIdRef.current;
    const entry: PrefetchedQuestion = {
      key,
      nextId,
      status: "pending",
      promise: Promise.resolve(),
    };
    entry.promise = requestNextQuestion(existingQuestions, nextId, {
      streamIntoState: false,
    })
      .then((question) => {
        if (runId !== runIdRef.current) return;
        entry.status = "ready";
        entry.question = question;
      })
      .catch((err: any) => {
        if (runId !== runIdRef.current) return;
        entry.status = "error";
        entry.error = err?.message ?? "后台预取下一题失败";
      });
    prefetchRef.current = entry;
  }

  async function submitAnswer() {
    const q = questions[cursor];
    if (!q || !answer.trim()) return;
    const ans = answer;
    const spokenDurationSec = draftSpeechSeconds || undefined;
    setAnswer("");
    setDraftSpeechSeconds(0);
    setBusy(true);
    setError("");
    const round: 1 | 2 = followUps[q.id] ? 2 : 1;
    const headers = apiHeaders(apiKey, baseUrl, model);
    try {
      if (round === 1) {
        setAnswers((m) => ({ ...m, [q.id]: ans }));
        setBusyMessage("评委还在思考要不要追问...");
        const firstRound = await decideFirstRound(
          headers,
          q,
          ans,
          spokenDurationSec,
        );
        if (firstRound.followUp) {
          setFollowUps((m) => ({ ...m, [q.id]: firstRound.followUp }));
          return;
        }
        if (firstRound.evaluation) {
          setEvals((m) => ({ ...m, [q.id]: firstRound.evaluation! }));
          return;
        }
        setBusyMessage("评委正在打分...");
        const ev = await streamEvaluate(q.id, headers, {
          question: q.question,
          referencePoints: q.reference_points,
          userAnswer: ans,
          spokenDurationSec,
        });
        setEvals((m) => ({ ...m, [q.id]: ev }));
      } else {
        setAnswers2((m) => ({ ...m, [q.id]: ans }));
        setBusyMessage("评委综合判分中...");
        const ev = await streamEvaluate(q.id, headers, {
          question: q.question,
          referencePoints: q.reference_points,
          userAnswer: answers[q.id],
          followUp: followUps[q.id],
          userAnswerFollowUp: ans,
          spokenDurationSec,
        });
        setEvals((m) => ({ ...m, [q.id]: ev }));
      }
    } catch (err: any) {
      setError(err.message);
      setAnswer(ans);
      setDraftSpeechSeconds(spokenDurationSec ?? 0);
      if (round === 1) {
        setAnswers((m) => {
          const n = { ...m };
          delete n[q.id];
          return n;
        });
      } else {
        setAnswers2((m) => {
          const n = { ...m };
          delete n[q.id];
          return n;
        });
      }
    } finally {
      setEvalDrafts((m) => {
        const n = { ...m };
        delete n[q.id];
        return n;
      });
      setBusy(false);
      setBusyMessage("");
    }
  }

  async function decideFirstRound(
    headers: Record<string, string>,
    q: Question,
    userAnswer: string,
    spokenDurationSec?: number,
  ): Promise<FirstRoundResult> {
    try {
      let streamed = "";
      const result = await postEventStream<{
        follow_up: string;
        evaluation: unknown;
      }>({
        url: "/api/follow-up",
        headers,
        body: {
          category: q.category,
          question: q.question,
          referencePoints: q.reference_points,
          userAnswer,
          includeEvaluation: true,
          spokenDurationSec,
        },
        onDelta: (text) => {
          streamed += text;
          setEvalDrafts((m) => ({ ...m, [q.id]: streamed }));
        },
      });
      const parsed =
        result.json ??
        parseJSON<{ follow_up: string; evaluation: unknown }>(
          result.text || streamed,
        );
      return {
        followUp: ((parsed.follow_up as string) || "").trim(),
        evaluation: normalizeEval(parsed.evaluation),
      };
    } catch (err: any) {
      setError(`追问生成失败，已直接进入评分：${err.message}`);
      return { followUp: "" };
    }
  }

  async function streamEvaluate(
    questionId: number,
    headers: Record<string, string>,
    body: Record<string, unknown>,
  ) {
    let streamed = "";
    const result = await postEventStream<EvalResult>({
      url: "/api/evaluate",
      headers,
      body,
      onDelta: (text) => {
        streamed += text;
        setEvalDrafts((m) => ({ ...m, [questionId]: streamed }));
      },
    });
    return result.json ?? parseJSON<EvalResult>(result.text || streamed);
  }

  async function nextQuestion() {
    if (busy) return;
    if (cursor + 1 < questions.length) {
      setCursor((c) => c + 1);
      prefetchNextQuestion(questions);
      return;
    }
    if (questions.length >= questionCount) {
      setPhase("done");
      return;
    }
    setError("");
    setPhase("generating");
    setBusy(true);
    setThinkingChars(0);
    try {
      const nextId = questions.length + 1;
      const key = questionPrefetchKey(questions, nextId);
      const prefetched =
        prefetchRef.current?.key === key && prefetchRef.current.nextId === nextId
          ? prefetchRef.current
          : null;
      if (prefetched?.status === "pending") {
        setBusyMessage(`正在接上第 ${nextId} 题...`);
      }
      if (prefetched) {
        await prefetched.promise;
      }
      const next =
        prefetched?.status === "ready" && prefetched.question
          ? prefetched.question
          : await requestNextQuestion(questions, nextId);
      const nextQuestions = [...questions, next];
      setQuestions((current) => {
        if (current.some((q) => q.id === next.id)) return current;
        return [...current, next];
      });
      setCursor(nextId - 1);
      setPhase("qa");
      prefetchNextQuestion(nextQuestions);
    } catch (err: any) {
      setError(err.message);
      setPhase("qa");
    } finally {
      setBusy(false);
      setBusyMessage("");
    }
  }

  function retakeQuestion(index: number) {
    const q = questions[index];
    if (!q || busy) return;
    setAnswers((m) => withoutKey(m, q.id));
    setAnswers2((m) => withoutKey(m, q.id));
    setFollowUps((m) => withoutKey(m, q.id));
    setEvals((m) => withoutKey(m, q.id));
    setEvalDrafts((m) => withoutKey(m, q.id));
    setOpenRef((m) => withoutKey(m, q.id));
    setAnswer("");
    setDraftSpeechSeconds(0);
    setError("");
    setCursor(index);
    setPhase("qa");
  }

  function exportMarkdown() {
    const md = buildExportMarkdown(questions, answers, followUps, answers2, evals);
    const url = URL.createObjectURL(
      new Blob([md], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `quodlibet-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function restart() {
    setCursor(0);
    setEvals({});
    setEvalDrafts({});
    setAnswers({});
    setFollowUps({});
    setAnswers2({});
    setAnswer("");
    setDraftSpeechSeconds(0);
    setOpenRef({});
    setPhase("parsed");
    resetPrefetch();
  }

  const currentQ = questions[cursor];
  const cid = currentQ?.id;
  const canAnswerRound1 = cid != null && !answers[cid];
  const canAnswerRound2 =
    cid != null && !!followUps[cid] && !answers2[cid];
  const inputVisible =
    phase === "qa" &&
    !!currentQ &&
    cid != null &&
    !evals[cid] &&
    !busy &&
    (canAnswerRound1 || canAnswerRound2);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: C.bg,
      }}
    >
      <TopBar
        title={phaseTitle(phase)}
        progress={
          phase === "qa"
            ? `${cursor + 1} / ${questionCount}`
            : phase === "done"
              ? `完成 · ${questions.length} 题`
              : ""
        }
        onSettings={() => setShowSettings(true)}
      />

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto" }}>
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "24px 16px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {phase === "idle" && <WelcomeCard onFile={handleUpload} />}

          {phase === "parsing" && <SystemBubble text="解析 PPT 中..." spinner />}

          {(phase === "parsed" ||
            phase === "generating" ||
            phase === "qa" ||
            phase === "done") &&
            slideCount > 0 && (
              <SystemBubble text={`📄 已解析 ${slideCount} 张幻灯片`} />
            )}

          {phase === "parsed" && (
            <CenterAction
              text={`准备好了吗？评委将根据你的 PPT 逐题提出 ${questionCount} 个问题。`}
              buttonLabel="开始答辩 →"
              disabled={busy}
              onClick={genQuestions}
            />
          )}

          {phase === "generating" && (
            <LoadingProgress
              isFirst={questions.length === 0}
              nextIndex={questions.length + 1}
              total={questionCount}
              thinkingChars={thinkingChars}
            />
          )}

          {(phase === "generating" || phase === "qa" || phase === "done") &&
            questions.map((q, i) => {
              if (phase !== "generating" && i > cursor) return null;
              const isOpen = !!openRef[q.id];
              const ans = answers[q.id];
              const fu = followUps[q.id];
              const ans2 = answers2[q.id];
              const ev = evals[q.id];
              const draft = evalDrafts[q.id];
              const isCurrent = phase !== "generating" && i === cursor;
              return (
                <div
                  key={q.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    animation: "qd-fade-in 200ms ease",
                  }}
                >
                  <JudgeBubble category={`Q${i + 1} · ${q.category}`}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: C.text,
                        lineHeight: 1.6,
                      }}
                    >
                      {q.question}
                    </div>
                    <button
                      onClick={() =>
                        setOpenRef((m) => ({ ...m, [q.id]: !isOpen }))
                      }
                      style={refToggleBtn()}
                    >
                      {isOpen ? "▾" : "▸"} 评委心中的要点（
                      {q.reference_points.length}）
                    </button>
                    {isOpen && (
                      <ul
                        style={{
                          margin: "8px 0 0",
                          paddingLeft: 20,
                          color: C.textMuted,
                          fontSize: 13,
                          lineHeight: 1.7,
                        }}
                      >
                        {q.reference_points.map((p, k) => (
                          <li key={k}>{p}</li>
                        ))}
                      </ul>
                    )}
                  </JudgeBubble>

                  {ans && <UserBubble text={ans} />}

                  {fu && (
                    <FollowUpBubble>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 500,
                          color: C.text,
                          lineHeight: 1.6,
                        }}
                      >
                        {fu}
                      </div>
                    </FollowUpBubble>
                  )}

                  {ans2 && <UserBubble text={ans2} />}

                  {ev && (
                    <JudgeBubble>
                      <EvalContent e={ev} />
                      {(isCurrent || phase === "done") && (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 14,
                            flexWrap: "wrap",
                          }}
                        >
                          {isCurrent && phase !== "done" && (
                            <button
                              disabled={busy}
                              onClick={nextQuestion}
                              style={primaryBtn()}
                            >
                              {i + 1 >= questions.length &&
                              questions.length >= questionCount
                                ? "完成 →"
                                : "下一题 →"}
                            </button>
                          )}
                          <button
                            onClick={() => retakeQuestion(i)}
                            style={isCurrent ? secondaryBtn() : primaryBtn()}
                          >
                            重答此题
                          </button>
                        </div>
                      )}
                    </JudgeBubble>
                  )}

                  {isCurrent &&
                    busy &&
                    !ev &&
                    (draft ? (
                      <EvalDraftBubble text={draft} />
                    ) : (
                      (ans || ans2) && (
                        <SystemBubble
                          text={busyMessage || "评委思考中..."}
                          spinner
                          inline
                        />
                      )
                    ))}
                </div>
              );
            })}

          {phase === "done" && (
            <JudgeBubble>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                🎉 本轮答辩结束
              </div>
              <div style={{ marginTop: 8, color: C.textMuted, fontSize: 14 }}>
                平均分{" "}
                <span
                  style={{
                    color: scoreColor(avgScore(evals)),
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {avgScore(evals).toFixed(1)}
                </span>{" "}
                <span style={{ color: C.textFaint }}>/ 10</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button style={primaryBtn()} onClick={exportMarkdown}>
                  导出 MD
                </button>
                <button style={secondaryBtn()} onClick={restart}>
                  再来一轮
                </button>
              </div>
            </JudgeBubble>
          )}

          {error && (
            <div
              style={{
                background: C.errorBg,
                border: `1px solid ${C.errorBorder}`,
                color: C.bad,
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              ⚠ {error}
            </div>
          )}
        </div>
      </div>

      {inputVisible && (
        <InputDock
          answer={answer}
          setAnswer={setAnswer}
          onSubmit={submitAnswer}
          busy={busy}
          placeholder={
            canAnswerRound2
              ? "回答评委追问... · Cmd/Ctrl+Enter 提交"
              : "输入你的回答 · Cmd/Ctrl+Enter 提交"
          }
          onSpeechDuration={(seconds) =>
            setDraftSpeechSeconds((total) => total + seconds)
          }
        />
      )}

      {showSettings && (
        <SettingsDrawer
          apiKey={apiKey}
          baseUrl={baseUrl}
          model={model}
          questionCount={questionCount}
          personas={personas}
          onKey={saveKey}
          onBaseUrl={saveBaseUrl}
          onModel={saveModel}
          onQuestionCount={saveQuestionCount}
          onPersonas={savePersonas}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function phaseTitle(p: Phase) {
  if (p === "idle" || p === "parsing") return "Quodlibet";
  if (p === "parsed" || p === "generating") return "Quodlibet · 待开始";
  if (p === "qa") return "Quodlibet · 答辩中";
  return "Quodlibet · 已完成";
}
