import { formatDeckBlock } from "./deck.js";
import type {
  ChatContext,
  ChatMessage,
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
        ctx.playerDeck
          ? ""
          : ctx.playerDeckName
            ? `Juego: ${ctx.playerDeckName} (lista de cartas no resuelta).`
            : "Mi deck no está especificado.",
        "",
        lessonBlock(ctx.lesson),
        "",
        "Usa MI lista de cartas (no un arquetipo genérico). Dame un briefing pre-duelo en español (nombres de cartas en inglés): plan con mis starters/extenders, cartas rivales a respetar, cuándo gastar MIS handtraps, y 3 objetivos concretos.",
      ].join("\n"),
    },
  ];
}

export function buildChatMessages(ctx: ChatContext): ChatMessage[] {
  const base: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "system",
      content: `Current rival: ${ctx.rivalName}\n${lessonBlock(ctx.lesson)}\n\n${formatDeckBlock(ctx.playerDeck)}`,
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
        lessonBlock(ctx.lesson),
        "",
        "Juzga las líneas con MI deck (starters, extenders y handtraps de la lista), no un arquetipo genérico.",
        "Para CADA jugada, decide:",
        "- ok: correcta o razonable",
        "- better: no es un error grave, pero había una opción mejor",
        "- bad: fue un error",
        "",
        "Responde SOLO JSON válido:",
        '{"steps":[{"id":0,"verdict":"ok","explanation":"..."}]}',
        "explanation: 1-3 frases en español. Nombres de cartas en inglés.",
        "Si verdict es better o bad, di qué se debió hacer en su lugar.",
        "",
        "Jugadas:",
        body,
      ].join("\n"),
    },
  ];
}
