import { formatDeckBlock } from "./deck.js";
import { formatGoalsBlock } from "./session.js";
import type {
  AcademyItem,
  ChatContext,
  ChatMessage,
  DeckListSnapshot,
  DeckPlanContext,
  PostDuelContext,
  PreDuelContext,
  ReplayReviewContext,
} from "./types.js";

const SYSTEM = `Eres un coach experto de Yu-Gi-Oh! TCG para una app de entrenamiento sobre Project Ignis EDOPro.
Sé conciso, práctico y preciso. Piensa en reglas modernas (Master Rule 5 / TCG).
No inventes interacciones ilegales. Si no estás seguro, dilo.
TODAS las explicaciones van en español.
Los nombres de cartas se escriben SIEMPRE en inglés, sin traducir.`;

function lessonBlock(lesson: PreDuelContext["lesson"]): string {
  return [
    `Matchup lesson: ${lesson.title}`,
    lesson.summary,
    `Win conditions: ${lesson.winConditions.join("; ")}`,
    `Respect: ${lesson.keyCardsRespect.join("; ")}`,
    `Negate priority: ${lesson.keyCardsNegate.join("; ")}`,
    `Handtraps: ${lesson.handtrapGuidance.join("; ")}`,
    `Mistakes: ${lesson.commonMistakes.join("; ")}`,
  ].join("\n");
}

export function buildPreDuelMessages(ctx: PreDuelContext): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Prepárame para un duelo de entrenamiento contra ${ctx.rivalName}.`,
        formatDeckBlock(ctx.playerDeck),
        formatGoalsBlock(ctx.sessionGoals),
        ctx.playerDeck
          ? ""
          : ctx.playerDeckName
            ? `Juego: ${ctx.playerDeckName} (lista de cartas no resuelta).`
            : "Mi deck no está especificado.",
        "",
        lessonBlock(ctx.lesson),
        "",
        "Usa MI lista de cartas (no un arquetipo genérico). Dame un briefing pre-duelo en español (nombres de cartas en inglés): plan con mis starters/extenders, cartas rivales a respetar, cuándo gastar MIS handtraps, y cómo cumplir los objetivos de esta sesión.",
      ].join("\n"),
    },
  ];
}

export function buildChatMessages(ctx: ChatContext): ChatMessage[] {
  const base: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "system",
      content: `Current rival: ${ctx.rivalName}\n${lessonBlock(ctx.lesson)}\n\n${formatDeckBlock(ctx.playerDeck)}\n${formatGoalsBlock(ctx.sessionGoals)}`,
    },
    ...ctx.history.filter((m) => m.role !== "system"),
    { role: "user", content: ctx.userMessage },
  ];
  return base;
}

export function buildPostDuelMessages(ctx: PostDuelContext): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Revisa mi duelo de entrenamiento contra ${ctx.rivalName}.`,
        ctx.resultHint ? `Resultado: ${ctx.resultHint}` : "",
        formatDeckBlock(ctx.playerDeck),
        formatGoalsBlock(ctx.sessionGoals),
        "",
        lessonBlock(ctx.lesson),
        "",
        "Fragmentos del replay:",
        ctx.replayText.slice(0, 10_000),
        "",
        "Responde en español (nombres de cartas en inglés): (1) qué salió mal, (2) 3 mejores líneas o hábitos, (3) un ejercicio para la próxima.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

export function buildStepReviewMessages(ctx: ReplayReviewContext): ChatMessage[] {
  const body = ctx.steps
    .map(
      (s) =>
        `#${s.id} [T${s.turn} ${s.phase}] ${s.actor} ${s.kind}: ${s.chosen}`,
    )
    .join("\n");
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Evalúa cada jugada de un duelo de entrenamiento contra ${ctx.rivalName}.`,
        formatDeckBlock(ctx.playerDeck),
        formatGoalsBlock(ctx.sessionGoals),
        ctx.drillKind && ctx.drillKind !== "open"
          ? `Drill mode: ${ctx.drillKind}. Prioriza evaluar ese drill.`
          : "",
        lessonBlock(ctx.lesson),
        "",
        "Juzga las líneas con MI deck (starters, extenders y handtraps de la lista), no un arquetipo genérico.",
        "actor you es el humano (puede ir primero o segundo). Evalúa solo sus decisiones, nunca el combo del WindBot.",
        "Para CADA jugada, decide:",
        "- ok: correcta o razonable",
        "- better: no es un error grave, pero había una opción mejor",
        "- bad: fue un error",
        "",
        "Responde SOLO JSON válido:",
        '{"steps":[{"id":0,"verdict":"ok","explanation":"...","betterLine":"..."}],"goals":[{"id":"g1","met":false,"note":"..."}],"academyId":"ash-timing","drillPrompt":"..."}',
        "explanation: 1-3 frases en español. Nombres de cartas en inglés.",
        "betterLine: si verdict es better o bad, la línea concreta que debió jugar. Si ok, omítela.",
        "goals: un objeto por cada session goal (usa el id). met true/false y note breve.",
        "academyId: el hábito a practicar la próxima (normal-summon, chain-priority, resources, tempo, ash-timing, side-mental).",
        "drillPrompt: 1 frase, el ejercicio para el próximo duelo.",
        "",
        "Jugadas:",
        body,
      ].join("\n"),
    },
  ];
}

export function buildDeckPlanMessages(
  ctx: DeckPlanContext,
  academy: AcademyItem[],
): ChatMessage[] {
  const academyLines = academy
    .map((a) => `- ${a.id}: ${a.title} — ${a.body}`)
    .join("\n");
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Crea un plan de entrenamiento para MI deck contra ${ctx.rivalName}.`,
        formatDeckBlock(ctx.playerDeck),
        lessonBlock(ctx.lesson),
        "",
        "Hábitos de academy disponibles (elige 2-3 academyId):",
        academyLines,
        "",
        "Responde SOLO JSON válido:",
        '{"deckSummary":"...","starters":["..."],"chokePoints":["..."],"goingFirst":"...","goingSecond":"...","goals":[{"id":"g1","text":"...","focus":"going-first","academyId":"tempo"}],"academyIds":["tempo","ash-timing"]}',
        "deckSummary: 1-2 frases en español, nombres de cartas en inglés.",
        "starters / chokePoints: nombres de cartas en inglés.",
        "goingFirst / goingSecond: 1 frase cada uno.",
        "goals: exactamente 3. focus uno de going-first, going-second, handtraps, resources, wincon.",
        "Cada goal.text es un objetivo de ESTA sesión, concreto y medible.",
      ].join("\n"),
    },
  ];
}

export function buildLabLessonMessages(input: {
  rivalName: string;
  rivalDeckKey: string;
  notes?: string;
  playerDeck?: DeckListSnapshot;
  rivalDeck?: DeckListSnapshot;
}): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Genera una lección de matchup para entrenar contra el WindBot "${input.rivalName}" (Deck=${input.rivalDeckKey}).`,
        input.notes ? `Notas: ${input.notes}` : "",
        formatDeckBlock(input.playerDeck),
        input.rivalDeck
          ? `Rival WindBot list:\n${formatDeckBlock(input.rivalDeck)}`
          : "Rival deck list unknown (executor may be embedded).",
        "",
        "Responde SOLO JSON válido con esta forma:",
        '{"id":"lab-x","rivalId":"lab-x","title":"...","summary":"...","winConditions":["..."],"keyCardsRespect":["..."],"keyCardsNegate":["..."],"tips":[{"title":"...","body":"..."}],"handtrapGuidance":["..."],"commonMistakes":["..."]}',
        "summary y arrays en español, nombres de cartas SIEMPRE en inglés.",
        "3-5 items por array. tips: 2-3.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}
