import type { RivalProfile, WindBotInventoryAnalysis } from "@yugioh/edopro-bridge";
import { getRival, rivals } from "./content";

export const LAB_PREFIX = "lab:";

export function labRivalId(deckKey: string): string {
  return `${LAB_PREFIX}${deckKey}`;
}

export function isLabRivalId(id: string): boolean {
  return id.startsWith(LAB_PREFIX);
}

export function rivalFromWindBot(d: {
  botName: string;
  deckKey: string;
  difficulty: number;
  masterRules: number[];
  hasYdk: boolean;
  ydkFileName: string | null;
}): RivalProfile {
  return {
    id: labRivalId(d.deckKey),
    name: d.botName,
    archetype: d.deckKey,
    difficulty: Math.min(5, Math.max(1, d.difficulty || 3)),
    windbotDeck: d.deckKey,
    windbotName: d.botName,
    masterRules: d.masterRules.length ? d.masterRules : [5],
    notes: d.hasYdk
      ? `Lab WindBot · ${d.ydkFileName}`
      : "Lab WindBot · embedded executor",
    lessonId: labRivalId(d.deckKey),
  };
}

function curatedDeckKeys(): Set<string> {
  return new Set(rivals.map((r) => r.windbotDeck.toLowerCase()));
}

export function labRivals(
  inventory: WindBotInventoryAnalysis | null,
): RivalProfile[] {
  if (!inventory) return [];
  const curated = curatedDeckKeys();
  return inventory.availableDecks
    .filter((d) => !curated.has(d.deckKey.toLowerCase()))
    .map(rivalFromWindBot)
    .sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name));
}

export function resolveRival(
  id: string,
  inventory: WindBotInventoryAnalysis | null,
): RivalProfile {
  const curated = getRival(id);
  if (curated) return curated;
  return labRivals(inventory).find((r) => r.id === id) ?? rivals[0];
}
