import type { SpeechRecognitionCtor } from "@/lib/types";

export function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  const w = window as Window &
    typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function mergeTranscript(base: string, addition: string) {
  const next = addition.trim();
  if (!next) return base;
  return base ? `${base}\n${next}` : next;
}
