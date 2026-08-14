import type { DeckListSnapshot } from "@yugioh/coach";
import { parseYdk, type YdkDeck } from "@yugioh/edopro-bridge";
import { resolveCardCatalog } from "./cardCatalog";
import { joinPath, native } from "./native";

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

export async function snapshotFromYdkFile(
  path: string,
  edoProPath: string,
): Promise<DeckListSnapshot | undefined> {
  try {
    const content = await native.readTextFile(path);
    const name =
      path.split(/[/\\]/).pop()?.replace(/\.ydk$/i, "") ?? "deck";
    const deck = parseYdk(content, name, path);
    const codes = [...deck.main, ...deck.extra, ...deck.side];
    const resolved = await resolveCardCatalog(edoProPath, codes);
    return snapshotFromYdk(deck, resolved.names);
  } catch {
    return undefined;
  }
}

export function windBotYdkPath(
  decksDir: string | null,
  ydkFileName: string | null,
): string | null {
  if (!decksDir || !ydkFileName) return null;
  return joinPath(decksDir, ydkFileName);
}
