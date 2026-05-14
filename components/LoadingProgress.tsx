"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/constants";
import { spinnerStyle } from "@/components/ui";

export function LoadingProgress({
  isFirst,
  nextIndex,
  total,
  thinkingChars,
}: {
  isFirst: boolean;
  nextIndex: number;
  total: number;
  thinkingChars: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  const phases = isFirst
    ? [
        { at: 0, text: "评委正在阅读你的 PPT..." },
        { at: 4, text: "评委正在分析关键论点..." },
        { at: 10, text: "评委正在斟酌问题角度..." },
        { at: 20, text: "评委还在组织语言，请稍候..." },
        { at: 40, text: "上游响应较慢，仍在等待第一个 token..." },
      ]
    : [
        { at: 0, text: `评委正在准备第 ${nextIndex} / ${total} 题...` },
        { at: 6, text: `第 ${nextIndex} 题正在收尾...` },
        { at: 20, text: "上游响应较慢，仍在等待..." },
      ];
  const baseStatus =
    [...phases].reverse().find((p) => elapsed >= p.at)?.text ?? phases[0].text;
  const status =
    thinkingChars > 0
      ? `评委思考中（已写 ${thinkingChars} 字思考）...`
      : baseStatus;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "12px 0",
        animation: "qd-fade-in 200ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          color: C.textMuted,
        }}
      >
        <span style={spinnerStyle()} />
        <span>{status}</span>
        <span style={{ color: C.textFaint, fontVariantNumeric: "tabular-nums" }}>
          {elapsed}s
        </span>
      </div>
      <div
        style={{
          width: 280,
          maxWidth: "60%",
          height: 4,
          borderRadius: 999,
          background: C.surfaceMuted,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "40%",
            background: `linear-gradient(90deg, transparent, ${C.primary}, transparent)`,
            animation: "qd-progress-slide 1.4s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}
