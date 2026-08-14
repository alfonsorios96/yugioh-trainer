import type { RivalProfile, WindBotEntry } from "./types.js";

export function rivalToWindBotEntry(rival: RivalProfile): WindBotEntry {
  return {
    name: rival.windbotName,
    deck: rival.windbotDeck,
    difficulty: rival.difficulty,
    masterRules: rival.masterRules,
  };
}

/**
 * Merge trainer rival entries into an existing bots.json array.
 * Matches by `name` and updates in place; appends missing entries.
 * Does not remove unrelated bots.
 */
export function mergeBotsJson(
  existing: WindBotEntry[],
  rivals: RivalProfile[],
): { bots: WindBotEntry[]; added: string[]; updated: string[] } {
  const bots = existing.map((b) => ({ ...b }));
  const added: string[] = [];
  const updated: string[] = [];

  for (const rival of rivals) {
    const entry = rivalToWindBotEntry(rival);
    const idx = bots.findIndex((b) => b.name === entry.name);
    if (idx === -1) {
      bots.push(entry);
      added.push(entry.name);
    } else {
      const prev = bots[idx];
      const changed =
        prev.deck !== entry.deck ||
        prev.difficulty !== entry.difficulty ||
        JSON.stringify(prev.masterRules) !== JSON.stringify(entry.masterRules);
      bots[idx] = entry;
      if (changed) updated.push(entry.name);
    }
  }

  return { bots, added, updated };
}

export function parseBotsJson(raw: string): WindBotEntry[] {
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("bots.json must be a JSON array");
  }
  return data.map((item, i) => {
    if (!item || typeof item !== "object") {
      throw new Error(`bots.json entry ${i} is invalid`);
    }
    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string" || typeof row.deck !== "string") {
      throw new Error(`bots.json entry ${i} needs name and deck`);
    }
    return {
      name: row.name,
      deck: row.deck,
      difficulty: typeof row.difficulty === "number" ? row.difficulty : 0,
      masterRules: Array.isArray(row.masterRules)
        ? row.masterRules.filter((n): n is number => typeof n === "number")
        : [5],
    };
  });
}

export function stringifyBotsJson(bots: WindBotEntry[]): string {
  return `${JSON.stringify(bots, null, 4)}\n`;
}
