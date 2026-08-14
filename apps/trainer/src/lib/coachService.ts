import {
  askCoach,
  getPostDuelReview,
  getPreDuelAdvice,
  reviewReplaySteps,
  type ChatMessage,
  type CoachConfig,
  type CoachResponse,
  type DeckListSnapshot,
  type MatchupLesson,
  type ReplayDecisionInput,
  type ReplayStepReview,
} from "@yugioh/coach";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { AppSettings } from "./settings";

function configFromSettings(settings: AppSettings): CoachConfig {
  return {
    apiKey: settings.apiKey.trim(),
    baseUrl: settings.apiBaseUrl.trim() || "https://api.openai.com/v1",
    model: settings.apiModel.trim() || "gpt-4o-mini",
  };
}

async function llmFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await tauriFetch(String(input), init);
  } catch {
    return fetch(input, init);
  }
}

export async function preDuelAdvice(
  settings: AppSettings,
  rivalName: string,
  lesson: MatchupLesson,
  playerDeck?: DeckListSnapshot,
): Promise<CoachResponse> {
  return getPreDuelAdvice(
    { rivalName, lesson, playerDeck, playerDeckName: playerDeck?.name },
    configFromSettings(settings),
    llmFetch,
  );
}

export async function chatWithCoach(
  settings: AppSettings,
  rivalName: string,
  lesson: MatchupLesson,
  history: ChatMessage[],
  userMessage: string,
  playerDeck?: DeckListSnapshot,
): Promise<CoachResponse> {
  return askCoach(
    { rivalName, lesson, history, userMessage, playerDeck },
    configFromSettings(settings),
    llmFetch,
  );
}

export type LlmProbeResult = {
  state: "ok" | "warn" | "bad";
  label: string;
};

/** Connectivity check: key against /models, then whether the configured model is listed. */
export async function probeLlmConnection(
  settings: AppSettings,
): Promise<LlmProbeResult> {
  const key = settings.apiKey.trim();
  if (!key) {
    return { state: "warn", label: "No API key · static coach" };
  }
  const base = (settings.apiBaseUrl || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = settings.apiModel.trim() || "gpt-4o-mini";
  try {
    const res = await llmFetch(`${base}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { state: "bad", label: "Invalid API key" };
    }
    if (!res.ok) {
      return { state: "bad", label: `HTTP ${res.status}` };
    }
    const payload = (await res.json().catch(() => null)) as {
      data?: Array<{ id?: string }>;
    } | null;
    const ids = Array.isArray(payload?.data)
      ? payload.data.map((row) => row.id).filter((id): id is string => Boolean(id))
      : [];
    if (ids.length > 0 && !ids.includes(model)) {
      return {
        state: "warn",
        label: `Key ok · "${model}" not on this API`,
      };
    }
    return { state: "ok", label: `Connected · ${model}` };
  } catch {
    return { state: "bad", label: "Unreachable" };
  }
}

export async function postDuelReview(
  settings: AppSettings,
  rivalName: string,
  lesson: MatchupLesson,
  replayText: string,
  resultHint?: string,
  playerDeck?: DeckListSnapshot,
): Promise<CoachResponse> {
  return getPostDuelReview(
    { rivalName, lesson, replayText, resultHint, playerDeck },
    configFromSettings(settings),
    llmFetch,
  );
}

export async function coachReplaySteps(
  settings: AppSettings,
  rivalName: string,
  lesson: MatchupLesson,
  steps: ReplayDecisionInput[],
  playerDeck?: DeckListSnapshot,
): Promise<ReplayStepReview> {
  return reviewReplaySteps(
    { rivalName, lesson, steps, playerDeck },
    configFromSettings(settings),
    llmFetch,
  );
}
