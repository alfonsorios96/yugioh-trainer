import {
  compactZones,
  MONSTER_ZONE_SLOTS,
  padStances,
  padZones,
  SPELL_ZONE_SLOTS,
} from "./zones.js";
import type {
  ComboBook,
  ComboExample,
  ComboSituation,
  ComboStep,
  EndBoard,
  SituationWhen,
} from "./types.js";

export function emptyEndBoard(): EndBoard {
  return {
    monsters: [],
    spells: [],
    grave: [],
    banished: [],
    monsterZones: padZones([], MONSTER_ZONE_SLOTS),
    spellZones: padZones([], SPELL_ZONE_SLOTS),
    monsterStances: padStances([], MONSTER_ZONE_SLOTS),
    spellStances: padStances([], SPELL_ZONE_SLOTS),
  };
}

function normalizeEndBoard(board?: EndBoard | null): EndBoard {
  const monsterZones = padZones(board?.monsterZones, MONSTER_ZONE_SLOTS);
  const spellZones = padZones(board?.spellZones, SPELL_ZONE_SLOTS);
  return {
    monsters: board?.monsters?.length ? board.monsters : compactZones(monsterZones),
    spells: board?.spells?.length ? board.spells : compactZones(spellZones),
    grave: board?.grave ?? [],
    banished: board?.banished ?? [],
    monsterZones,
    spellZones,
    monsterStances: padStances(board?.monsterStances, MONSTER_ZONE_SLOTS),
    spellStances: padStances(board?.spellStances, SPELL_ZONE_SLOTS),
  };
}

function hasEndBoardCards(board: EndBoard): boolean {
  return (
    board.monsters.length +
      board.spells.length +
      board.grave.length +
      board.banished.length +
      compactZones(board.monsterZones).length +
      compactZones(board.spellZones).length >
    0
  );
}

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
    priority: s.priority,
    examples: (Array.isArray(s.examples) ? s.examples : []).map((example) => ({
      ...example,
      endBoard: normalizeEndBoard(example.endBoard),
      endBoardAcceptable: example.endBoardAcceptable
        ? normalizeEndBoard(example.endBoardAcceptable)
        : undefined,
    })),
    steps: Array.isArray(s.steps)
      ? s.steps.map((step) => ({
          ...step,
          isOutcome: step.isOutcome,
        }))
      : [],
    endBoard: normalizeEndBoard(s.endBoard),
    endBoardAcceptable: s.endBoardAcceptable
      ? normalizeEndBoard(s.endBoardAcceptable)
      : undefined,
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

export function situationSlug(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "situacion";
}

export function uniqueSituationId(book: ComboBook, base: string): string {
  const root = situationSlug(base);
  if (!findSituation(book, root)) return root;
  let n = 2;
  while (findSituation(book, `${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

function isDerivedSituationId(situationId: string, title: string): boolean {
  const root = situationSlug(title);
  return situationId === root || situationId.startsWith(`${root}-`);
}

export function retargetSituationId(
  book: ComboBook,
  currentId: string,
  oldTitle: string,
  newTitle: string,
): string {
  const title = newTitle.trim() || oldTitle;
  if (!isDerivedSituationId(currentId, oldTitle)) return currentId;
  const others: ComboBook = {
    ...book,
    situations: book.situations.filter((s) => s.situationId !== currentId),
  };
  return uniqueSituationId(others, title);
}

export function createSituation(
  book: ComboBook,
  input: {
    title?: string;
    notes?: string;
    when?: ComboSituation["when"];
    situationId?: string;
  } = {},
): ComboBook {
  const title = input.title?.trim() || "Nueva situación";
  const situationId =
    input.situationId?.trim() || uniqueSituationId(book, title);
  if (findSituation(book, situationId)) {
    throw new Error(`Ya existe la situación ${situationId}`);
  }
  return upsertSituation(book, {
    situationId,
    title,
    notes: input.notes ?? "",
    when: input.when ?? {},
    examples: [],
    steps: [],
    endBoard: emptyEndBoard(),
  });
}

export function deleteSituation(
  book: ComboBook,
  situationId: string,
): ComboBook {
  if (!findSituation(book, situationId)) {
    throw new Error(`Unknown situation ${situationId}`);
  }
  return {
    ...book,
    situations: book.situations.filter((s) => s.situationId !== situationId),
  };
}

export function updateSituation(
  book: ComboBook,
  situationId: string,
  patch: Partial<
    Pick<ComboSituation, "title" | "notes" | "when" | "situationId">
  >,
): ComboBook {
  const current = findSituation(book, situationId);
  if (!current) {
    throw new Error(`Unknown situation ${situationId}`);
  }
  const title =
    patch.title !== undefined
      ? patch.title.trim() || current.title
      : current.title;
  let nextId = current.situationId;
  if (patch.situationId !== undefined) {
    nextId = patch.situationId.trim();
    if (!nextId) {
      throw new Error("situationId cannot be empty");
    }
  } else if (patch.title !== undefined) {
    nextId = retargetSituationId(book, current.situationId, current.title, title);
  }
  if (nextId !== situationId && findSituation(book, nextId)) {
    throw new Error(`Ya existe la situación ${nextId}`);
  }
  const updated: ComboSituation = {
    ...current,
    situationId: nextId,
    title,
    notes: patch.notes !== undefined ? patch.notes : current.notes,
    when: patch.when !== undefined ? patch.when : current.when,
  };
  return {
    ...book,
    situations: book.situations.map((s) =>
      s.situationId === situationId ? updated : s,
    ),
  };
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
      place: step.place ?? extra.place,
      stance: step.stance ?? extra.stance,
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
  const endBoard = hasEndBoardCards(current.endBoard)
    ? current.endBoard
    : normalizeEndBoard(example.endBoard);
  return upsertSituation(book, {
    ...current,
    examples,
    steps,
    endBoard,
    endBoardAcceptable:
      current.endBoardAcceptable ?? example.endBoardAcceptable,
  });
}

export function assignReplayToSituation(
  book: ComboBook,
  situationId: string,
  example: ComboExample,
  when?: SituationWhen,
): ComboBook {
  const current = findSituation(book, situationId);
  if (!current) {
    throw new Error(`Unknown situation ${situationId}`);
  }
  const threats = when?.threats?.filter(Boolean);
  return upsertSituation(book, {
    ...current,
    notes: example.notes?.trim() || current.notes,
    examples: [example],
    steps: example.steps.length ? example.steps : current.steps,
    endBoard: hasEndBoardCards(normalizeEndBoard(example.endBoard))
      ? normalizeEndBoard(example.endBoard)
      : current.endBoard,
    endBoardAcceptable: example.endBoardAcceptable ?? current.endBoardAcceptable,
    when: when
      ? {
          ...current.when,
          ...when,
          threats: threats?.length ? threats : undefined,
        }
      : current.when,
  });
}

export function clearSituationReplay(
  book: ComboBook,
  situationId: string,
): ComboBook {
  const current = findSituation(book, situationId);
  if (!current) {
    throw new Error(`Unknown situation ${situationId}`);
  }
  return upsertSituation(book, {
    ...current,
    examples: [],
    steps: [],
    endBoard: emptyEndBoard(),
    endBoardAcceptable: undefined,
    when: {},
  });
}

export function bookCardIds(book: ComboBook): number[] {
  const ids = new Set<number>();
  const add = (id: number | undefined) => {
    if (id && id > 0) ids.add(id);
  };
  const addAll = (list: number[] | undefined) => {
    for (const id of list ?? []) add(id);
  };
  const addStep = (step: ComboStep) => {
    add(step.cardId);
    addAll(step.selectCard);
    addAll(step.selectNextCard);
  };
  for (const sit of book.situations) {
    addAll(sit.when.handContains);
    addAll(sit.when.handExcludes);
    addAll(sit.endBoard.monsters);
    addAll(sit.endBoard.spells);
    addAll(sit.endBoard.grave);
    addAll(sit.endBoard.banished);
    addAll(sit.endBoard.monsterZones);
    addAll(sit.endBoard.spellZones);
    addAll(sit.endBoardAcceptable?.monsters);
    addAll(sit.endBoardAcceptable?.spells);
    addAll(sit.endBoardAcceptable?.grave);
    addAll(sit.endBoardAcceptable?.banished);
    for (const step of sit.steps) addStep(step);
    for (const example of sit.examples) {
      addAll(example.openingHand);
      addAll(example.endBoard.monsters);
      addAll(example.endBoard.spells);
      addAll(example.endBoard.grave);
      addAll(example.endBoard.banished);
      addAll(example.endBoard.monsterZones);
      addAll(example.endBoard.spellZones);
      for (const step of example.steps) addStep(step);
    }
  }
  return [...ids];
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
