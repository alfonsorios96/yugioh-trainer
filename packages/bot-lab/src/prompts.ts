import type { ChatMessage, ComboBook, ComboModel, ComboSituation, Diagnosis } from "./types.js";

const SYSTEM = `Eres un autor de IA para WindBot (Yu-Gi-Oh! TCG, Toon 2026).
Traduces líneas de combo y replays a un modelo de combo (nodos/aristas) y a parches de SelectCard.
No inventes interacciones ilegales. Nombres de cartas SIEMPRE en inglés. Explicaciones en español.
Responde SOLO JSON válido.`;

export function buildModelMessages(input: {
  notes: string;
  engineExcerpt: string;
  bookSummary: string;
}): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        "Construye o corrige el ComboModel (nodes[], edges[] con kind requires|enables|window|recovers).",
        `Notas humanas:\n${input.notes}`,
        `Resumen del libro:\n${input.bookSummary}`,
        `Handlers actuales (extracto):\n${input.engineExcerpt.slice(0, 8000)}`,
        'JSON: { "deckId": "toon-2026", "nodes": [...], "edges": [...] }',
      ].join("\n\n"),
    },
  ];
}

export function buildHypothesisMessages(input: {
  diagnosis: Diagnosis;
  situation?: ComboSituation;
  book: ComboBook;
}): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Diagnóstico: ${input.diagnosis.verdict} (${input.diagnosis.notes})`,
        input.situation
          ? `Situación: ${input.situation.situationId} — ${input.situation.notes}`
          : "Situación desconocida.",
        `Libro: ${input.book.situations.map((s) => s.situationId).join(", ")}`,
        'JSON: { "patches": [{ "kind": "selectCard"|"selectNextCard", "cardId": number, "ids": number[] }], "reason": string }',
      ].join("\n\n"),
    },
  ];
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("LLM did not return JSON");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

export function parseComboModelJson(text: string): ComboModel {
  const obj = parseJsonObject(text) as unknown as ComboModel;
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
    throw new Error("ComboModel JSON missing nodes/edges");
  }
  return {
    deckId: obj.deckId || "toon-2026",
    nodes: obj.nodes,
    edges: obj.edges,
  };
}

export function bookSummary(book: ComboBook): string {
  return book.situations
    .map((s) => `${s.situationId}: ${s.title} (${s.notes})`)
    .join("\n");
}
