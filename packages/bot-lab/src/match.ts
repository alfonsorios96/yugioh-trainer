import type { ComboStep, EndBoard } from "./types.js";

function counts(ids: number[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const id of ids) {
    if (id <= 0) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

function missingCounts(expected: number[], actual: number[]): number[] {
  const have = counts(actual);
  const missing: number[] = [];
  for (const id of expected) {
    const n = have.get(id) ?? 0;
    if (n <= 0) missing.push(id);
    else have.set(id, n - 1);
  }
  return missing;
}

export function matchZone(expected: number[], actual: number[]): number[] {
  return missingCounts(expected, actual);
}

export function matchEndBoard(
  expected: EndBoard,
  actual: EndBoard,
): { ok: boolean; missing: number[] } {
  const missing = [
    ...matchZone(expected.monsters, actual.monsters),
    ...matchZone(expected.spells, actual.spells),
    ...matchZone(expected.grave ?? [], actual.grave ?? []),
    ...matchZone(expected.banished ?? [], actual.banished ?? []),
  ];
  return { ok: missing.length === 0, missing };
}

export function stepCardSequence(steps: ComboStep[]): number[] {
  return steps.map((s) => s.cardId);
}

/** Longest prefix of expected card sequence present (in order) in actual. */
export function sequencePrefixLength(expected: number[], actual: number[]): number {
  let i = 0;
  let j = 0;
  while (i < expected.length && j < actual.length) {
    if (expected[i] === actual[j]) i += 1;
    j += 1;
  }
  return i;
}
