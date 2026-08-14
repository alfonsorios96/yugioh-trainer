import type { YdkDeck } from "./types.js";

/** Parse a .ydk deck file into main/extra/side passcode lists. */
export function parseYdk(content: string, name: string, path = ""): YdkDeck {
  const lines = content.split(/\r?\n/);
  let section: "main" | "extra" | "side" | null = null;
  const main: number[] = [];
  const extra: number[] = [];
  const side: number[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#created")) continue;
    if (line === "#main") {
      section = "main";
      continue;
    }
    if (line === "#extra") {
      section = "extra";
      continue;
    }
    if (line === "!side") {
      section = "side";
      continue;
    }
    if (line.startsWith("#") || line.startsWith("!")) continue;
    const code = Number.parseInt(line, 10);
    if (!Number.isFinite(code) || code <= 0) continue;
    if (section === "main") main.push(code);
    else if (section === "extra") extra.push(code);
    else if (section === "side") side.push(code);
  }

  return { name, path, main, extra, side };
}

export function serializeYdk(deck: Pick<YdkDeck, "main" | "extra" | "side">): string {
  const lines = ["#created by yugioh-trainer", "#main"];
  for (const code of deck.main) lines.push(String(code));
  lines.push("#extra");
  for (const code of deck.extra) lines.push(String(code));
  lines.push("!side");
  for (const code of deck.side) lines.push(String(code));
  lines.push("");
  return lines.join("\n");
}

export function validateYdkStructure(deck: YdkDeck): string[] {
  const issues: string[] = [];
  if (deck.main.length < 40 || deck.main.length > 60) {
    issues.push(`Main deck should be 40–60 cards (found ${deck.main.length}).`);
  }
  if (deck.extra.length > 15) {
    issues.push(`Extra deck max is 15 (found ${deck.extra.length}).`);
  }
  if (deck.side.length > 15) {
    issues.push(`Side deck max is 15 (found ${deck.side.length}).`);
  }
  return issues;
}

/** Best-effort validation against a set of known card passcodes from cards.cdb. */
export function validateYdkAgainstDb(deck: YdkDeck, knownCodes: Set<number>): string[] {
  const issues = validateYdkStructure(deck);
  const unknown = [...deck.main, ...deck.extra, ...deck.side].filter(
    (code) => !knownCodes.has(code),
  );
  const unique = [...new Set(unknown)];
  if (unique.length > 0) {
    issues.push(
      `${unique.length} unknown passcode(s): ${unique.slice(0, 8).join(", ")}${
        unique.length > 8 ? "…" : ""
      }`,
    );
  }
  return issues;
}
