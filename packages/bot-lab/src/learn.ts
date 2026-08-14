import { applyEnginePatches, patchesAreSelectOnly } from "./apply.js";
import { findSituation } from "./book.js";
import {
  compileComboBook,
  undoPatchesFor,
  validateNoRegression,
} from "./compile.js";
import type { ExtractedLine } from "./extract.js";
import type {
  ComboBook,
  Diagnosis,
  EnginePatch,
  LearnCycleResult,
  LearningEntry,
} from "./types.js";

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

/**
 * Deterministic hypothesis: put the situation's SelectCard IDs first
 * on the card that diverged, without dropping existing IDs (via compile).
 */
export function hypothesizePatches(
  book: ComboBook,
  diagnosis: Diagnosis,
  engineSource: string,
): EnginePatch[] {
  if (diagnosis.verdict === "ok" || !diagnosis.situationId) return [];
  const sit = findSituation(book, diagnosis.situationId);
  if (!sit) return compileComboBook(book, engineSource);
  const focused: ComboBook = {
    ...book,
    situations: [sit],
  };
  return compileComboBook(focused, engineSource);
}

export function runLearnCycle(input: {
  book: ComboBook;
  diagnosis: Diagnosis;
  engineSource: string;
  replayName: string;
  line?: ExtractedLine;
}): LearnCycleResult {
  const { book, diagnosis, engineSource, replayName } = input;
  const patches = hypothesizePatches(book, diagnosis, engineSource);
  const undoPatches = undoPatchesFor(engineSource, patches);
  const baseEntry = (extra: Partial<LearningEntry>): LearningEntry => ({
    at: Date.now(),
    replay: replayName,
    verdict: diagnosis.verdict,
    situationId: diagnosis.situationId,
    applied: false,
    patches,
    undoPatches,
    origin: "bot",
    ...extra,
  });

  if (diagnosis.verdict === "ok") {
    const entry = baseEntry({ reason: diagnosis.notes });
    return { diagnosis, patches: [], applied: false, entry };
  }

  if (patches.length === 0) {
    const entry = baseEntry({
      reason: "Sin parche SelectCard aplicable; queda en cola.",
    });
    return {
      diagnosis,
      patches,
      applied: false,
      reason: entry.reason,
      entry,
    };
  }

  if (!patchesAreSelectOnly(patches)) {
    const entry = baseEntry({
      reason: "El parche no es solo SelectCard; requiere revisión.",
    });
    return { diagnosis, patches, applied: false, reason: entry.reason, entry };
  }

  const nextSource = applyEnginePatches(engineSource, patches);
  const regression = validateNoRegression(book, nextSource);
  if (!regression.ok) {
    const entry = baseEntry({
      reason: `Regresión: faltan ${regression.missing.map((m) => m.id).join(", ")}`,
    });
    return { diagnosis, patches, applied: false, reason: entry.reason, entry };
  }

  const entry = baseEntry({
    applied: true,
    reason: `Auto-aplicado (${diagnosis.verdict})`,
  });
  return {
    diagnosis,
    patches,
    applied: true,
    nextSource,
    reason: entry.reason,
    entry,
  };
}

export function undoLastApplied(
  engineSource: string,
  entries: LearningEntry[],
): { source: string; entries: LearningEntry[] } | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (!e.applied || e.undoPatches.length === 0) continue;
    const source = applyEnginePatches(engineSource, e.undoPatches);
    const next = entries.slice(0, i).concat({
      ...e,
      applied: false,
      reason: `${e.reason ?? ""} (deshecho)`,
    });
    return { source, entries: next };
  }
  return null;
}
