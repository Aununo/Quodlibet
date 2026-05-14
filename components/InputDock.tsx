"use client";

import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/constants";
import type { SpeechRecognitionLike } from "@/lib/types";
import { getSpeechRecognitionCtor, mergeTranscript } from "@/lib/speech";
import { iconBtn, primaryBtn, recordingDotStyle } from "@/components/ui";

export function InputDock({
  answer,
  setAnswer,
  onSubmit,
  busy,
  placeholder,
  onSpeechDuration,
}: {
  answer: string;
  setAnswer: (s: string) => void;
  onSubmit: () => void;
  busy: boolean;
  placeholder: string;
  onSpeechDuration: (seconds: number) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTranscriptRef = useRef("");
  const startedAtRef = useRef(0);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognitionCtor());
    return () => recognitionRef.current?.abort();
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [answer]);

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!busy && answer.trim()) onSubmit();
    }
  }

  function toggleSpeech() {
    if (busy || !speechSupported) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    baseTranscriptRef.current = answer.trim();
    startedAtRef.current = performance.now();

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      if (startedAtRef.current) {
        onSpeechDuration((performance.now() - startedAtRef.current) / 1000);
        startedAtRef.current = 0;
      }
    };
    recognition.onerror = () => {
      setListening(false);
      startedAtRef.current = 0;
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText.trim()) {
        baseTranscriptRef.current = mergeTranscript(
          baseTranscriptRef.current,
          finalText,
        );
      }
      setAnswer(mergeTranscript(baseTranscriptRef.current, interimText));
    };
    recognition.start();
  }

  return (
    <div
      style={{
        borderTop: `1px solid ${C.border}`,
        background: C.surface,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "12px 16px",
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <button
          style={iconBtn({
            fontSize: 18,
            color: listening ? C.bad : C.text,
            background: listening ? "#fef2f2" : "transparent",
          })}
          aria-label="record"
          title={
            speechSupported
              ? listening
                ? "停止语音输入"
                : "开始语音输入"
              : "当前浏览器不支持语音输入"
          }
          disabled={busy || !speechSupported}
          onClick={toggleSpeech}
        >
          🎙
        </button>
        <textarea
          ref={taRef}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder={placeholder}
          style={{
            flex: 1,
            resize: "none",
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 14,
            color: C.text,
            background: C.bg,
            lineHeight: 1.5,
            fontFamily: "inherit",
            outline: "none",
            maxHeight: 200,
            overflowY: "auto",
          }}
        />
        {listening && (
          <div
            aria-label="recording"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: C.bad,
              fontSize: 12,
              paddingBottom: 11,
              flexShrink: 0,
            }}
          >
            <span style={recordingDotStyle()} />
            识别中
          </div>
        )}
        <button
          style={primaryBtn({
            marginTop: 0,
            padding: "0 18px",
            height: 40,
          })}
          disabled={busy || !answer.trim()}
          onClick={onSubmit}
        >
          {busy ? "..." : "提交"}
        </button>
      </div>
    </div>
  );
}
