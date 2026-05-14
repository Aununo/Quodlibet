export type Phase = "idle" | "parsing" | "parsed" | "generating" | "qa" | "done";

export interface Question {
  id: number;
  category: string;
  question: string;
  reference_points: string[];
}

export interface EvalResult {
  score: number;
  highlights: string[];
  gaps: string[];
  improved_answer: string;
}

export interface FirstRoundResult {
  followUp: string;
  evaluation?: EvalResult;
}

export interface PrefetchedQuestion {
  key: string;
  nextId: number;
  status: "pending" | "ready" | "error";
  question?: Question;
  error?: string;
  promise: Promise<void>;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: {
          length: number;
          [index: number]: {
            isFinal: boolean;
            [index: number]: { transcript: string };
          };
        };
      }) => void)
    | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
