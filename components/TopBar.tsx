"use client";

import { C } from "@/lib/constants";
import { iconBtn } from "@/components/ui";

export function TopBar({
  title,
  progress,
  onSettings,
}: {
  title: string;
  progress: string;
  onSettings: () => void;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 16px",
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
        {title}
      </div>
      <div style={{ flex: 1 }} />
      {progress && (
        <div
          style={{
            fontSize: 13,
            color: C.textMuted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {progress}
        </div>
      )}
      <button onClick={onSettings} style={iconBtn()} aria-label="settings">
        ⚙
      </button>
    </header>
  );
}
