import {
  formatPostDuelStatic,
  formatPreDuelStatic,
  formatStaticChatReply,
  DEFAULT_ACADEMY,
} from "./static.js";
import {
  buildChatMessages,
  buildDeckPlanMessages,
  buildPostDuelMessages,
  buildPreDuelMessages,
  buildStepReviewMessages,
} from "./prompts.js";
import {
  formatStaticSessionPlan,
  parseSessionPlanJson,
} from "./session.js";
import { completeChat, hasLlmConfig } from "./llm.js";
import type {
  AcademyItem,
  ChatContext,
  CoachConfig,
  CoachResponse,
  CoachVerdict,
  DeckPlanContext,
  PostDuelContext,
  PreDuelContext,
  ReplayDecisionInput,
  ReplayReviewContext,
  SessionPlan,
  StepCoaching,
} from "./types.js";

export type {
  LessonTip,
  MatchupLesson,
  AcademyItem,
  CoachConfig,
  ChatMessage,
  DeckListSnapshot,
  DeckPlanContext,
  SessionFocus,
  SessionGoal,
  SessionPlan,
  PreDuelContext,
  ChatContext,
  PostDuelContext,
  ReplayReviewContext,
  CoachResponse,
  CoachVerdict,
  ReplayDecisionInput,
  StepCoaching,
} from "./types.js";

export { formatDeckBlock, compactDeckLines, uniqueCardCount } from "./deck.js";
export {
  academyForPlan,
  formatGoalsBlock,
  formatStaticSessionPlan,
} from "./session.js";

export {
  formatPreDuelStatic,
  formatStaticChatReply,
  formatPostDuelStatic,
  DEFAULT_ACADEMY,
} from "./static.js";

export {
  buildPreDuelMessages,
  buildChatMessages,
  buildPostDuelMessages,
} from "./prompts.js";

export { completeChat, hasLlmConfig } from "./llm.js";
export type { CompleteChatOptions } from "./llm.js";

export async function getPreDuelAdvice(
  ctx: PreDuelContext,
  config: CoachConfig,
  fetchImpl?: typeof fetch,
): Promise<CoachResponse> {
  if (!hasLlmConfig(config)) {
    return formatPreDuelStatic(ctx);
  }
  try {
    return await completeChat(config, buildPreDuelMessages(ctx), fetchImpl);
  } catch (e) {
    const fallback = formatPreDuelStatic(ctx);
    const reason = e instanceof Error ? e.message : String(e);
    return {
      ...fallback,
      content: `${fallback.content}\n\n_(LLM unavailable — ${reason})_`,
    };
  }
}

export async function askCoach(
  ctx: ChatContext,
  config: CoachConfig,
  fetchImpl?: typeof fetch,
): Promise<CoachResponse> {
  if (!hasLlmConfig(config)) {
    return formatStaticChatReply(ctx.lesson, ctx.userMessage, ctx.playerDeck);
  }
  try {
    return await completeChat(config, buildChatMessages(ctx), fetchImpl);
  } catch (e) {
    const fallback = formatStaticChatReply(ctx.lesson, ctx.userMessage, ctx.playerDeck);
    const reason = e instanceof Error ? e.message : String(e);
    return {
      ...fallback,
      content: `${fallback.content}\n\n_(LLM unavailable — ${reason})_`,
    };
  }
}

export async function getPostDuelReview(
  ctx: PostDuelContext,
  config: CoachConfig,
  fetchImpl?: typeof fetch,
): Promise<CoachResponse> {
  if (!hasLlmConfig(config)) {
    return formatPostDuelStatic(ctx.lesson, ctx.replayText, ctx.playerDeck);
  }
  try {
    return await completeChat(config, buildPostDuelMessages(ctx), fetchImpl);
  } catch (e) {
    const fallback = formatPostDuelStatic(ctx.lesson, ctx.replayText, ctx.playerDeck);
    const reason = e instanceof Error ? e.message : String(e);
    return {
      ...fallback,
      content: `${fallback.content}\n\n_(LLM unavailable — ${reason})_`,
    };
  }
}

export { DEFAULT_ACADEMY as academyDefaults };

export async function getDeckSessionPlan(
  ctx: DeckPlanContext,
  academy: AcademyItem[],
  config: CoachConfig,
  fetchImpl?: typeof fetch,
): Promise<SessionPlan> {
  const fallback = formatStaticSessionPlan(ctx, academy);
  if (!hasLlmConfig(config)) return fallback;
  try {
    const result = await completeChat(
      config,
      buildDeckPlanMessages(ctx, academy),
      fetchImpl,
      { json: true },
    );
    return parseSessionPlanJson(result.content, fallback, result.usedModel);
  } catch {
    return fallback;
  }
}

function parseVerdict(value: unknown): CoachVerdict {
  return value === "bad" || value === "better" || value === "ok" ? value : "ok";
}

function staticStepNote(step: ReplayDecisionInput): StepCoaching {
  if (!step.decision) {
    return {
      id: step.id,
      verdict: "ok",
      explanation: "Paso de contexto (robo, fase o jugada del rival).",
    };
  }
  if (step.kind === "attack") {
    return {
      id: step.id,
      verdict: "better",
      explanation:
        "Revisa si el ataque era necesario. Si el rival tenía un board más grande o un negate, quizás era mejor pasar y desarrollar.",
    };
  }
  return {
    id: step.id,
    verdict: "ok",
    explanation:
      "Jugada razonable a falta de un análisis con IA. Pregúntate si adelantó tu win condition o si debías esperar interacción.",
  };
}

export type ReplayStepReview = {
  source: "static" | "llm";
  coaching: StepCoaching[];
  error?: string;
  usedModel?: string;
};

export async function reviewReplaySteps(
  ctx: ReplayReviewContext,
  config: CoachConfig,
  fetchImpl?: typeof fetch,
): Promise<ReplayStepReview> {
  const fallback = ctx.steps.map(staticStepNote);
  if (!hasLlmConfig(config)) {
    return {
      source: "static",
      coaching: fallback,
      error:
        "No API key in Settings. Save the LLM fields (or keep a key in .env.local) and analyze again.",
    };
  }
  try {
    const decisions = ctx.steps.filter((s) => s.decision).slice(0, 36);
    if (decisions.length === 0) {
      return { source: "llm", coaching: fallback, usedModel: config.model };
    }
    const result = await completeChat(
      config,
      buildStepReviewMessages({ ...ctx, steps: decisions }),
      fetchImpl,
      { json: true },
    );
    const jsonText = (() => {
      const raw = result.content.trim();
      const fenced = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      const start = fenced.indexOf("{");
      const end = fenced.lastIndexOf("}");
      if (start >= 0 && end > start) return fenced.slice(start, end + 1);
      return fenced;
    })();
    const parsed = JSON.parse(jsonText) as { steps?: Array<Record<string, unknown>> };
    const byId = new Map<number, StepCoaching>();
    for (const row of parsed.steps ?? []) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      const fallbackNote = ctx.steps.find((s) => s.id === id);
      byId.set(id, {
        id,
        verdict: parseVerdict(row.verdict),
        explanation:
          String(row.explanation ?? "").trim() ||
          (fallbackNote ? staticStepNote(fallbackNote).explanation : ""),
      });
    }
    return {
      source: "llm",
      coaching: ctx.steps.map((s) => byId.get(s.id) ?? staticStepNote(s)),
      usedModel: result.usedModel,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { source: "static", coaching: fallback, error: reason };
  }
}
