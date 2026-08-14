import { compactDeckLines } from "./deck.js";
import type {
  AcademyItem,
  DeckPlanContext,
  SessionFocus,
  SessionGoal,
  SessionPlan,
} from "./types.js";

const FOCUSES: SessionFocus[] = [
  "going-first",
  "going-second",
  "handtraps",
  "resources",
  "wincon",
];

function parseFocus(value: unknown): SessionFocus {
  return FOCUSES.includes(value as SessionFocus)
    ? (value as SessionFocus)
    : "wincon";
}

function uniqueNames(names: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = name.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}

export function formatGoalsBlock(goals?: SessionGoal[]): string {
  if (!goals?.length) return "";
  return [
    "Session goals (evaluate these in advice and replay review):",
    ...goals.map((g, i) => `${i + 1}. [${g.focus}] ${g.text}`),
  ].join("\n");
}

export function formatStaticSessionPlan(
  ctx: DeckPlanContext,
  academy: AcademyItem[],
): SessionPlan {
  const { lesson, rivalName, playerDeck } = ctx;
  const name = playerDeck?.name ?? "your deck";
  const starters = playerDeck
    ? uniqueNames(playerDeck.main, 6)
    : ["Your engine starters"];
  const byId = new Map(academy.map((a) => [a.id, a]));
  const academyIds = ["tempo", "ash-timing", "resources"].filter((id) =>
    byId.has(id),
  );
  const goals: SessionGoal[] = [
    {
      id: "g1",
      text: `Play ${name} to a real win condition vs ${rivalName} — do not goldfish.`,
      focus: "wincon",
      academyId: "tempo",
    },
    {
      id: "g2",
      text:
        lesson.handtrapGuidance[0] ??
        "Hold Ash / Imperm for the search that completes their engine.",
      focus: "handtraps",
      academyId: "ash-timing",
    },
    {
      id: "g3",
      text: "Keep follow-up. A flashy board that empties hand/GY can lose to one break.",
      focus: "resources",
      academyId: "resources",
    },
  ];
  return {
    deckSummary: playerDeck
      ? `${name} (${playerDeck.main.length}+${playerDeck.extra.length}). Main: ${compactDeckLines(uniqueNames(playerDeck.main, 12))}.`
      : `Select a .ydk to personalize this plan vs ${rivalName}.`,
    starters,
    chokePoints: lesson.keyCardsNegate.slice(0, 4),
    goingFirst: `Resolve ${name} under 1 handtrap and keep a follow-up body or search.`,
    goingSecond:
      lesson.winConditions[0] ??
      "Break their board without emptying your turn.",
    goals,
    academyIds,
    source: "static",
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function parseSessionPlanJson(
  raw: string,
  fallback: SessionPlan,
  usedModel?: string,
): SessionPlan {
  const fenced = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  const jsonText = start >= 0 && end > start ? fenced.slice(start, end + 1) : fenced;
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const goalsRaw = Array.isArray(parsed.goals) ? parsed.goals : [];
  const goals: SessionGoal[] = goalsRaw.slice(0, 4).map((row, i) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      id: String(item.id ?? `g${i + 1}`),
      text: String(item.text ?? fallback.goals[i]?.text ?? "Play to the win condition."),
      focus: parseFocus(item.focus),
      academyId:
        typeof item.academyId === "string" ? item.academyId : fallback.goals[i]?.academyId,
    };
  });
  const starters = asStringArray(parsed.starters).slice(0, 8);
  const chokePoints = asStringArray(parsed.chokePoints).slice(0, 6);
  const academyIds = asStringArray(parsed.academyIds).slice(0, 4);
  return {
    deckSummary: String(parsed.deckSummary ?? fallback.deckSummary).trim() || fallback.deckSummary,
    starters: starters.length ? starters : fallback.starters,
    chokePoints: chokePoints.length ? chokePoints : fallback.chokePoints,
    goingFirst: String(parsed.goingFirst ?? fallback.goingFirst).trim() || fallback.goingFirst,
    goingSecond:
      String(parsed.goingSecond ?? fallback.goingSecond).trim() || fallback.goingSecond,
    goals: goals.length > 0 ? goals : fallback.goals,
    academyIds: academyIds.length ? academyIds : fallback.academyIds,
    source: "llm",
    usedModel,
  };
}

export function academyForPlan(
  plan: SessionPlan,
  academy: AcademyItem[],
): AcademyItem[] {
  const ids = [
    ...plan.academyIds,
    ...plan.goals.map((g) => g.academyId ?? ""),
  ].filter(Boolean);
  const seen = new Set<string>();
  const byId = new Map(academy.map((a) => [a.id, a]));
  const out: AcademyItem[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const item = byId.get(id);
    if (!item) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}
