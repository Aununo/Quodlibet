"use client";

import type { ReactNode } from "react";
import { C } from "@/lib/constants";
import type { EvalResult } from "@/lib/types";
import { humanizeStreamingJSON } from "@/lib/streaming";
import { avatarStyle, scoreColor, spinnerStyle } from "@/components/ui";

export function SystemBubble({
  text,
  spinner,
  inline,
}: {
  text: string;
  spinner?: boolean;
  inline?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: inline ? "4px 0" : "8px 0",
      }}
    >
      <div
        style={{
          background: C.surfaceMuted,
          color: C.textMuted,
          fontSize: 12,
          padding: "6px 14px",
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {spinner && <span style={spinnerStyle()} />}
        {text}
      </div>
    </div>
  );
}

export function JudgeBubble({
  category,
  children,
}: {
  category?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={avatarStyle(C.surfaceMuted, C.border)}>🎓</div>
      <div style={{ flex: 1, minWidth: 0, maxWidth: "calc(100% - 42px)" }}>
        {category && (
          <div
            style={{
              fontSize: 11,
              color: C.textFaint,
              marginBottom: 4,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            {category}
          </div>
        )}
        <div
          style={{
            background: C.judgeBubble,
            border: `1px solid ${C.border}`,
            padding: "12px 14px",
            borderRadius: 14,
            borderTopLeftRadius: 4,
            color: C.text,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function FollowUpBubble({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={avatarStyle("#fff7ed", "#fed7aa")}>?</div>
      <div style={{ flex: 1, minWidth: 0, maxWidth: "calc(100% - 42px)" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#fff7ed",
            border: `1px solid #fed7aa`,
            color: "#9a3412",
            borderRadius: 999,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 5,
          }}
        >
          评委追问
        </div>
        <div
          style={{
            background: "#fffaf5",
            border: `1px solid #fed7aa`,
            padding: "12px 14px",
            borderRadius: 14,
            borderTopLeftRadius: 4,
            color: C.text,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        flexDirection: "row-reverse",
      }}
    >
      <div style={avatarStyle("#dbeafe", "#bfdbfe")}>🙋</div>
      <div style={{ maxWidth: "calc(100% - 42px)", minWidth: 0 }}>
        <div
          style={{
            background: C.userBubble,
            color: C.userText,
            padding: "12px 14px",
            borderRadius: 14,
            borderTopRightRadius: 4,
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

export function EvalDraftBubble({ text }: { text: string }) {
  return (
    <JudgeBubble category="评委正在写反馈">
      <div
        style={{
          color: C.textMuted,
          fontSize: 13,
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 120,
          overflow: "hidden",
        }}
      >
        {humanizeStreamingJSON(text) || "正在组织评分..."}
      </div>
    </JudgeBubble>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          color: C.textMuted,
          fontSize: 12,
          marginBottom: 4,
          fontWeight: 500,
        }}
      >
        {title}
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 13,
          color: C.text,
          lineHeight: 1.7,
        }}
      >
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

export function EvalContent({ e }: { e: EvalResult }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: scoreColor(e.score),
          }}
        >
          {e.score}
        </span>
        <span style={{ color: C.textFaint, fontSize: 13 }}>/ 10</span>
      </div>
      {e.highlights.length > 0 && <Block title="✅ 亮点" items={e.highlights} />}
      {e.gaps.length > 0 && <Block title="⚠ 待改进" items={e.gaps} />}
      {e.improved_answer && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              color: C.textMuted,
              fontSize: 12,
              marginBottom: 6,
              fontWeight: 500,
            }}
          >
            📝 评委希望的回答示范
          </div>
          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
              color: C.text,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {e.improved_answer}
          </div>
        </div>
      )}
    </div>
  );
}
