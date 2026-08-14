import type { MatchupLesson } from "./types.js";

function strings(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const out = value.map((item) => String(item).trim()).filter(Boolean);
  return out.length ? out : fallback;
}

export function parseMatchupLessonJson(
  raw: string,
  fallback: MatchupLesson,
): MatchupLesson {
  const fenced = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  const jsonText = start >= 0 && end > start ? fenced.slice(start, end + 1) : fenced;
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const tipsRaw = Array.isArray(parsed.tips) ? parsed.tips : [];
  const tips = tipsRaw
    .map((row) => {
      const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const title = String(item.title ?? "").trim();
      const body = String(item.body ?? "").trim();
      if (!title && !body) return null;
      return { title: title || "Tip", body: body || title };
    })
    .filter((t): t is { title: string; body: string } => Boolean(t));
  return {
    id: String(parsed.id ?? fallback.id),
    rivalId: String(parsed.rivalId ?? fallback.rivalId),
    title: String(parsed.title ?? fallback.title).trim() || fallback.title,
    summary: String(parsed.summary ?? fallback.summary).trim() || fallback.summary,
    winConditions: strings(parsed.winConditions, fallback.winConditions),
    keyCardsRespect: strings(parsed.keyCardsRespect, fallback.keyCardsRespect),
    keyCardsNegate: strings(parsed.keyCardsNegate, fallback.keyCardsNegate),
    tips: tips.length ? tips : fallback.tips,
    handtrapGuidance: strings(parsed.handtrapGuidance, fallback.handtrapGuidance),
    commonMistakes: strings(parsed.commonMistakes, fallback.commonMistakes),
  };
}
