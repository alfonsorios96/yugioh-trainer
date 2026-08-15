import type { CardStance, ComboStep, EndBoard } from "./types.js";

const LOC_MZONE = 0x04;
const LOC_SZONE = 0x08;

export const MONSTER_ZONE_SLOTS = 7;
export const SPELL_ZONE_SLOTS = 6;

/** MZ1–MZ5, then two Extra Monster Zones, then ST1–ST5 and Field. */
export function placeLabel(loc: number, seq: number): string | undefined {
  if (loc & LOC_MZONE) {
    if (seq >= 0 && seq <= 4) return `MZ${seq + 1}`;
    if (seq === 5) return "EMZ";
    if (seq === 6) return "EMZ2";
  }
  if (loc & LOC_SZONE) {
    if (seq === 5) return "Campo";
    if (seq >= 0 && seq <= 4) return `ST${seq + 1}`;
  }
  return undefined;
}

export function stanceFromPos(pos: number | undefined, kind?: string): CardStance {
  if (kind === "set") return "set";
  const p = pos ?? 0;
  if (!p) return "";
  if ((p & 0x05) === 0 && (p & 0x0a) !== 0) return "set";
  if ((p & 0x04) !== 0 && (p & 0x01) === 0) return "def";
  return "atk";
}

export function stanceTitle(stance: CardStance | undefined): string {
  if (stance === "set") return "boca abajo";
  if (stance === "def") return "defensa";
  if (stance === "atk") return "ataque";
  return "";
}

export function padStances(
  values: (CardStance | undefined)[] | undefined,
  len: number,
): CardStance[] {
  const out: CardStance[] = Array.from({ length: len }, () => "");
  for (let i = 0; i < Math.min(values?.length ?? 0, len); i++) {
    const v = values![i];
    if (v === "atk" || v === "def" || v === "set") out[i] = v;
  }
  return out;
}

export function padZones(ids: number[] | undefined, len: number): number[] {
  const out = Array.from({ length: len }, () => 0);
  for (let i = 0; i < Math.min(ids?.length ?? 0, len); i++) {
    const id = Number(ids![i]);
    out[i] = Number.isFinite(id) && id > 0 ? id : 0;
  }
  return out;
}

export function compactZones(ids: number[] | undefined): number[] {
  return padZones(ids, ids?.length ?? 0).filter((id) => id > 0);
}

export function monsterPlaceTitle(place: string): string {
  if (place === "EMZ") return "Extra Monster Zone";
  if (place === "EMZ2") return "Extra Monster Zone 2";
  if (place.startsWith("MZ")) return `Monster Zone ${place.slice(2)}`;
  if (place === "Campo") return "Field Zone";
  if (place.startsWith("ST")) return `Magic/Trap Zone ${place.slice(2)}`;
  return place;
}

const PLACE_SLOT: Record<string, { row: "mz" | "st"; index: number }> = {
  MZ1: { row: "mz", index: 0 },
  MZ2: { row: "mz", index: 1 },
  MZ3: { row: "mz", index: 2 },
  MZ4: { row: "mz", index: 3 },
  MZ5: { row: "mz", index: 4 },
  EMZ: { row: "mz", index: 5 },
  EMZ2: { row: "mz", index: 6 },
  ST1: { row: "st", index: 0 },
  ST2: { row: "st", index: 1 },
  ST3: { row: "st", index: 2 },
  ST4: { row: "st", index: 3 },
  ST5: { row: "st", index: 4 },
  Campo: { row: "st", index: 5 },
};

/** Prefer stored zone arrays; otherwise replay the last `place` of each card. */
export function applyPlacesToBoard(
  board: EndBoard,
  steps: ComboStep[] = [],
): EndBoard {
  const monsterZones = padZones(board.monsterZones, MONSTER_ZONE_SLOTS);
  const spellZones = padZones(board.spellZones, SPELL_ZONE_SLOTS);
  const monsterStances = padStances(board.monsterStances, MONSTER_ZONE_SLOTS);
  const spellStances = padStances(board.spellStances, SPELL_ZONE_SLOTS);
  const lastPlace = new Map<number, string>();
  const lastStance = new Map<number, CardStance>();
  for (const step of steps) {
    if (step.cardId <= 0) continue;
    if (step.place) lastPlace.set(step.cardId, step.place);
    if (step.stance) lastStance.set(step.cardId, step.stance);
    else if (step.kind === "set") lastStance.set(step.cardId, "set");
  }
  const applyStance = (code: number, row: "mz" | "st", index: number) => {
    const stance = lastStance.get(code);
    if (!stance) return;
    if (row === "mz") {
      if (!monsterStances[index]) monsterStances[index] = stance;
    } else if (!spellStances[index]) {
      spellStances[index] = stance;
    }
  };
  if (compactZones(monsterZones).length + compactZones(spellZones).length > 0) {
    monsterZones.forEach((code, i) => {
      if (code > 0) applyStance(code, "mz", i);
    });
    spellZones.forEach((code, i) => {
      if (code > 0) applyStance(code, "st", i);
    });
    return { ...board, monsterZones, spellZones, monsterStances, spellStances };
  }
  const put = (code: number) => {
    const slot = PLACE_SLOT[lastPlace.get(code) ?? ""];
    if (!slot) return;
    if (slot.row === "mz") monsterZones[slot.index] = code;
    else spellZones[slot.index] = code;
    applyStance(code, slot.row, slot.index);
  };
  for (const code of board.monsters ?? []) put(code);
  for (const code of board.spells ?? []) put(code);
  return { ...board, monsterZones, spellZones, monsterStances, spellStances };
}
