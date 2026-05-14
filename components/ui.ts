import type { CSSProperties } from "react";
import { C } from "@/lib/constants";

export function scoreColor(n: number) {
  if (n >= 8) return C.good;
  if (n >= 5) return C.warn;
  return C.bad;
}

export function primaryBtn(extra: CSSProperties = {}): CSSProperties {
  return {
    background: C.primary,
    color: "#fff",
    border: 0,
    borderRadius: 10,
    padding: "9px 16px",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    marginTop: 0,
    ...extra,
  };
}

export function secondaryBtn(extra: CSSProperties = {}): CSSProperties {
  return {
    background: C.surface,
    color: C.text,
    border: `1px solid ${C.borderStrong}`,
    borderRadius: 10,
    padding: "9px 16px",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    marginTop: 0,
    ...extra,
  };
}

export function iconBtn(extra: CSSProperties = {}): CSSProperties {
  return {
    background: "transparent",
    border: 0,
    fontSize: 16,
    padding: "6px 8px",
    cursor: "pointer",
    color: C.text,
    borderRadius: 8,
    lineHeight: 1,
    ...extra,
  };
}

export function refToggleBtn(): CSSProperties {
  return {
    background: "transparent",
    border: 0,
    padding: "10px 0 0",
    color: C.textMuted,
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
    display: "block",
  };
}

export function fieldInput(): CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "10px 12px",
    color: C.text,
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
  };
}

export function avatarStyle(bg: string, border: string): CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 16,
    background: bg,
    border: `1px solid ${border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    flexShrink: 0,
  };
}

export function spinnerStyle(): CSSProperties {
  return {
    display: "inline-block",
    width: 10,
    height: 10,
    border: `2px solid ${C.textFaint}`,
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "qd-spin 800ms linear infinite",
  };
}

export function recordingDotStyle(): CSSProperties {
  return {
    display: "inline-block",
    width: 8,
    height: 8,
    background: C.bad,
    borderRadius: "50%",
    animation: "qd-pulse 900ms ease-in-out infinite",
  };
}
