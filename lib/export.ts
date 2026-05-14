import type { EvalResult, Question } from "@/lib/types";

export function withoutKey<T>(record: Record<number, T>, key: number) {
  const next = { ...record };
  delete next[key];
  return next;
}

export function avgScore(evals: Record<number, EvalResult>) {
  const arr = Object.values(evals);
  if (!arr.length) return 0;
  return arr.reduce((s, e) => s + e.score, 0) / arr.length;
}

function markdownList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`) : ["- 无"];
}

export function buildExportMarkdown(
  questions: Question[],
  answers: Record<number, string>,
  followUps: Record<number, string>,
  answers2: Record<number, string>,
  evals: Record<number, EvalResult>,
) {
  const lines = [
    "# Quodlibet 答辩记录",
    "",
    `导出时间：${new Date().toLocaleString("zh-CN")}`,
    `平均分：${avgScore(evals).toFixed(1)} / 10`,
    "",
  ];

  questions.forEach((q, i) => {
    const ev = evals[q.id];
    lines.push(`## Q${i + 1} · ${q.category}`, "", q.question, "");
    lines.push("### 我的回答", "", answers[q.id] || "_未作答_", "");
    if (followUps[q.id]) {
      lines.push("### 评委追问", "", followUps[q.id], "");
      lines.push("### 追问回答", "", answers2[q.id] || "_未作答_", "");
    }
    if (ev) {
      lines.push("### 评估", "", `分数：${ev.score} / 10`, "");
      lines.push("亮点：");
      lines.push(...markdownList(ev.highlights));
      lines.push("", "待改进：");
      lines.push(...markdownList(ev.gaps));
      if (ev.improved_answer) {
        lines.push("", "示范回答：", "", ev.improved_answer);
      }
      lines.push("");
    }
  });

  return `${lines.join("\n").trim()}\n`;
}
