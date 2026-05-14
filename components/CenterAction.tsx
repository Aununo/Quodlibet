"use client";

import { C } from "@/lib/constants";
import { primaryBtn } from "@/components/ui";

export function CenterAction({
  text,
  buttonLabel,
  onClick,
  disabled,
}: {
  text: string;
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "16px 16px 8px",
      }}
    >
      <div style={{ color: C.textMuted, fontSize: 14, textAlign: "center" }}>
        {text}
      </div>
      <button
        style={primaryBtn({ padding: "10px 20px", fontSize: 15 })}
        disabled={disabled}
        onClick={onClick}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
