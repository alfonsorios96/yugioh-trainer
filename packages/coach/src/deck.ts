import type { DeckListSnapshot } from "./types.js";

/** Collapse copies into "3x Ash Blossom & Joyous Spring" lines. */
export function compactDeckLines(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) {
    const key = name.trim() || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, n]) => (n > 1 ? `${n}x ${name}` : name))
    .join(", ");
}

export function uniqueCardCount(deck: DeckListSnapshot): number {
  return new Set([...deck.main, ...deck.extra, ...deck.side]).size;
}

export function formatDeckBlock(deck?: DeckListSnapshot): string {
  if (!deck) return "Player deck list: not provided.";
  return [
    `Player deck: ${deck.name}`,
    `Main (${deck.main.length}): ${compactDeckLines(deck.main) || "(empty)"}`,
    `Extra (${deck.extra.length}): ${compactDeckLines(deck.extra) || "(empty)"}`,
    `Side (${deck.side.length}): ${compactDeckLines(deck.side) || "(empty)"}`,
  ].join("\n");
}
