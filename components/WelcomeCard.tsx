"use client";

import { useRef, useState } from "react";
import { C } from "@/lib/constants";

export function WelcomeCard({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "40px 24px 16px",
      }}
    >
      <div style={{ fontSize: 32, fontWeight: 700, color: C.text }}>
        Quodlibet
      </div>
      <div
        style={{
          color: C.textMuted,
          fontSize: 13,
          fontStyle: "italic",
        }}
      >
        ask whatever you wish — 中世纪学者公开问答的名字
      </div>
      <div
        style={{
          color: C.textMuted,
          fontSize: 14,
          textAlign: "center",
          maxWidth: 480,
          lineHeight: 1.7,
          marginTop: 4,
        }}
      >
        上传 PPT → Claude 扮演评委提问 → 你回答 → Claude 评估并给出改进建议
      </div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        style={{
          marginTop: 20,
          padding: "36px 48px",
          background: dragging ? C.primaryDim : C.surface,
          border: `2px dashed ${dragging ? C.primary : C.borderStrong}`,
          borderRadius: 14,
          cursor: "pointer",
          color: C.textMuted,
          fontSize: 14,
          textAlign: "center",
          transition: "all 120ms ease",
          minWidth: 280,
        }}
      >
        <div style={{ fontSize: 36 }}>📄</div>
        <div style={{ marginTop: 10, color: C.text, fontWeight: 500 }}>
          点击或拖拽 .pptx 文件到这里
        </div>
        <div style={{ marginTop: 4, color: C.textFaint, fontSize: 12 }}>
          仅本次会话使用，不会上传到任何第三方
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pptx"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
