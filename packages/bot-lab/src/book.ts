import type {
  ComboBook,
  ComboExample,
  ComboSituation,
  ComboStep,
} from "./types.js";

export function emptyBook(deckId = "toon-2026"): ComboBook {
  return {
    deckId,
    engineFile: "src/Engines/ToonEngine.cs",
    situations: [],
  };
}

export function parseComboBook(raw: unknown): ComboBook {
  if (!raw || typeof raw !== "object") {
    throw new Error("ComboBook must be an object");
  }
  const obj = raw as ComboBook;
  if (!obj.deckId || !Array.isArray(obj.situations)) {
    throw new Error("ComboBook needs deckId and situations[]");
  }
  return {
    deckId: obj.deckId,
    engineFile: obj.engineFile || "src/Engines/ToonEngine.cs",
    situations: obj.situations.map(normalizeSituation),
  };
}

function normalizeSituation(s: ComboSituation): ComboSituation {
  return {
    situationId: s.situationId,
    title: s.title || s.situationId,
    notes: s.notes || "",
    when: s.when || {},
    examples: Array.isArray(s.examples) ? s.examples : [],
    steps: Array.isArray(s.steps) ? s.steps : [],
    endBoard: s.endBoard || { monsters: [], spells: [], grave: [] },
    endBoardAcceptable: s.endBoardAcceptable,
  };
}

export function findSituation(
  book: ComboBook,
  situationId: string,
): ComboSituation | undefined {
  return book.situations.find((s) => s.situationId === situationId);
}

export function upsertSituation(
  book: ComboBook,
  situation: ComboSituation,
): ComboBook {
  const idx = book.situations.findIndex(
    (s) => s.situationId === situation.situationId,
  );
  const situations = [...book.situations];
  if (idx >= 0) situations[idx] = situation;
  else situations.push(situation);
  return { ...book, situations };
}

function mergeSteps(canonical: ComboStep[], incoming: ComboStep[]): ComboStep[] {
  if (canonical.length === 0) return incoming.map((s) => ({ ...s }));
  return canonical.map((step, i) => {
    const extra = incoming[i];
    if (!extra || extra.cardId !== step.cardId) return step;
    return {
      ...step,
      selectCard: step.selectCard?.length ? step.selectCard : extra.selectCard,
      selectNextCard: step.selectNextCard?.length
        ? step.selectNextCard
        : extra.selectNextCard,
    };
  });
}

export function addExampleToSituation(
  book: ComboBook,
  situationId: string,
  example: ComboExample,
): ComboBook {
  const current = findSituation(book, situationId);
  if (!current) {
    throw new Error(`Unknown situation ${situationId}`);
  }
  const examples = [...current.examples, example];
  const steps = mergeSteps(current.steps, example.steps);
  const endBoard =
    current.endBoard.monsters.length + current.endBoard.spells.length > 0
      ? current.endBoard
      : example.endBoard;
  return upsertSituation(book, {
    ...current,
    examples,
    steps,
    endBoard,
    endBoardAcceptable:
      current.endBoardAcceptable ?? example.endBoardAcceptable,
  });
}

export function allSelectExpectations(book: ComboBook): {
  cardId: number;
  selectCard: number[];
  selectNextCard: number[];
}[] {
  const byCard = new Map<
    number,
    { cardId: number; selectCard: number[]; selectNextCard: number[] }
  >();
  for (const sit of book.situations) {
    for (const step of sit.steps) {
      const cur = byCard.get(step.cardId) ?? {
        cardId: step.cardId,
        selectCard: [],
        selectNextCard: [],
      };
      for (const id of step.selectCard ?? []) {
        if (!cur.selectCard.includes(id)) cur.selectCard.push(id);
      }
      for (const id of step.selectNextCard ?? []) {
        if (!cur.selectNextCard.includes(id)) cur.selectNextCard.push(id);
      }
      byCard.set(step.cardId, cur);
    }
  }
  return [...byCard.values()].filter(
    (e) => e.selectCard.length + e.selectNextCard.length > 0,
  );
}
