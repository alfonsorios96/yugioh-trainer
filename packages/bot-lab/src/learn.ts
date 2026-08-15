import type { LearningEntry } from "./types.js";

export function parseLearningLog(text: string): LearningEntry[] {
  if (!text.trim()) return [];
  const out: LearningEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as LearningEntry);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

export function serializeLearningLog(entries: LearningEntry[]): string {
  if (entries.length === 0) return "";
  return `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`;
}

export function appendLearningEntry(
  text: string,
  entry: LearningEntry,
): string {
  const entries = parseLearningLog(text);
  entries.push(entry);
  return serializeLearningLog(entries);
}
