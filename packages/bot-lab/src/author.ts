import { defaultToonComboModel } from "./model.js";
import { completeChat, hasLlmConfig } from "./llm.js";
import {
  buildHypothesisMessages,
  buildModelMessages,
  parseComboModelJson,
  parseJsonObject,
} from "./prompts.js";
import type {
  ComboBook,
  ComboModel,
  Diagnosis,
  EnginePatch,
  LlmConfig,
} from "./types.js";
import { findSituation } from "./book.js";
import { hypothesizePatches } from "./learn.js";

export async function suggestComboModel(
  config: LlmConfig,
  input: { notes: string; engineExcerpt: string; bookSummary: string },
): Promise<ComboModel> {
  if (!hasLlmConfig(config)) return defaultToonComboModel();
  const text = await completeChat(config, buildModelMessages(input));
  return parseComboModelJson(text);
}

export async function suggestHypothesis(
  config: LlmConfig,
  input: {
    diagnosis: Diagnosis;
    book: ComboBook;
    engineSource: string;
  },
): Promise<{ patches: EnginePatch[]; reason: string; source: "llm" | "rules" }> {
  const fallback = {
    patches: hypothesizePatches(input.book, input.diagnosis, input.engineSource),
    reason: "Hipótesis determinista (SelectCard del libro).",
    source: "rules" as const,
  };
  if (!hasLlmConfig(config)) return fallback;
  try {
    const situation = input.diagnosis.situationId
      ? findSituation(input.book, input.diagnosis.situationId)
      : undefined;
    const text = await completeChat(
      config,
      buildHypothesisMessages({
        diagnosis: input.diagnosis,
        situation,
        book: input.book,
      }),
    );
    const obj = parseJsonObject(text);
    const patches = Array.isArray(obj.patches)
      ? (obj.patches as EnginePatch[])
      : fallback.patches;
    return {
      patches,
      reason: typeof obj.reason === "string" ? obj.reason : fallback.reason,
      source: "llm",
    };
  } catch {
    return fallback;
  }
}
