import type { DeckListSnapshot } from "@yugioh/coach";
import type { YdkDeck } from "@yugioh/edopro-bridge";

export function snapshotFromYdk(
  deck: YdkDeck,
  names: Record<string, string>,
): DeckListSnapshot {
  const label = (code: number) => names[String(code)] || `#${code}`;
  return {
    name: deck.name,
    main: deck.main.map(label),
    extra: deck.extra.map(label),
    side: deck.side.map(label),
  };
}
