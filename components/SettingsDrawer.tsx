"use client";

import type { ReactNode } from "react";
import { C, DEFAULT_MODEL, PERSONAS } from "@/lib/constants";
import { fieldInput, iconBtn } from "@/components/ui";

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label
      style={{
        fontSize: 12,
        color: C.textMuted,
        fontWeight: 500,
        marginTop: 4,
      }}
    >
      {children}
    </label>
  );
}

export function SettingsDrawer({
  apiKey,
  baseUrl,
  model,
  questionCount,
  personas,
  onKey,
  onBaseUrl,
  onModel,
  onQuestionCount,
  onPersonas,
  onClose,
}: {
  apiKey: string;
  baseUrl: string;
  model: string;
  questionCount: number;
  personas: string[];
  onKey: (s: string) => void;
  onBaseUrl: (s: string) => void;
  onModel: (s: string) => void;
  onQuestionCount: (n: number) => void;
  onPersonas: (s: string[]) => void;
  onClose: () => void;
}) {
  function togglePersona(persona: string) {
    if (personas.includes(persona)) {
      onPersonas(personas.filter((p) => p !== persona));
    } else {
      onPersonas([...personas, persona]);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.35)",
          zIndex: 10,
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 360,
          maxWidth: "100%",
          background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          zIndex: 11,
          padding: "20px 20px 24px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: "-8px 0 24px rgba(15,23,42,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>设置</div>
          <button style={iconBtn()} onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <FieldLabel>API Key（BYOK）</FieldLabel>
        <input
          type="password"
          placeholder="sk-ant-... 或 relay token"
          value={apiKey}
          onChange={(e) => onKey(e.target.value)}
          style={fieldInput()}
        />
        <FieldLabel>Base URL（可选）</FieldLabel>
        <input
          type="text"
          placeholder="https://api.anthropic.com"
          value={baseUrl}
          onChange={(e) => onBaseUrl(e.target.value)}
          style={fieldInput()}
        />
        <FieldLabel>Model</FieldLabel>
        <input
          type="text"
          placeholder={DEFAULT_MODEL}
          value={model}
          onChange={(e) => onModel(e.target.value)}
          style={fieldInput()}
        />
        <FieldLabel>题目数量：{questionCount}</FieldLabel>
        <input
          type="range"
          min={1}
          max={10}
          value={questionCount}
          onChange={(e) => onQuestionCount(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <FieldLabel>评委人设</FieldLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {PERSONAS.map((persona) => (
            <label
              key={persona}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
                color: C.text,
              }}
            >
              <input
                type="checkbox"
                checked={personas.includes(persona)}
                disabled={personas.length === 1 && personas.includes(persona)}
                onChange={() => togglePersona(persona)}
              />
              {persona}
            </label>
          ))}
        </div>
        <div
          style={{
            color: C.textFaint,
            fontSize: 12,
            marginTop: 6,
            lineHeight: 1.7,
          }}
        >
          🔒 Key / Base URL / Model 仅保存在本机浏览器 localStorage；
          请求经服务端透传给上游，<b>不写库、不打日志</b>。
        </div>
      </aside>
    </>
  );
}
