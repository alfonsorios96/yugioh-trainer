import type { ReplayFileInfo } from "./types.js";

const REPLAY_EXTENSIONS = [".yrp", ".yrpx", ".yrpX", ".json"];

export function isReplayFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return REPLAY_EXTENSIONS.some((ext) => lower.endsWith(ext.toLowerCase()));
}

/** EDOPro overwrites `_LastReplay.yrp(X)` after every duel — skip it in History. */
export function isLastReplayFilename(name: string): boolean {
  const stem = name.replace(/\.(yrpx|yrp|json)$/i, "").trim();
  return stem.toLowerCase() === "_lastreplay";
}

export function pickLatestReplay(files: ReplayFileInfo[]): ReplayFileInfo | null {
  if (files.length === 0) return null;
  return [...files].sort((a, b) => b.modifiedMs - a.modifiedMs)[0] ?? null;
}

/** EDOPro names files like `Toon vs Blue-Eyes 13-08-001.yrpX`. */
export function parseReplayFilename(filename: string): {
  player?: string;
  opponent?: string;
} {
  const stem = filename.replace(/\.(yrpx|yrp|json)$/i, "");
  const match = stem.match(/^(.+?)\s+vs\s+(.+?)(?:\s+\d{1,2}-\d{2}-\d+.*)?$/i);
  if (!match) return {};
  return { player: match[1]?.trim(), opponent: match[2]?.trim() };
}

function extractPrintableAscii(bytes: Uint8Array): string {
  const runs: string[] = [];
  let current = "";
  for (const byte of bytes) {
    if (byte >= 0x20 && byte <= 0x7e) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= 4) runs.push(current);
      current = "";
    }
  }
  if (current.length >= 4) runs.push(current);
  return runs.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Best-effort text extraction from replay bytes/strings for LLM context.
 * Binary .yrp / .yrpX formats yield limited ASCII snippets; JSON replays yield more.
 */
export function extractReplaySummaryText(
  filename: string,
  content: string | Uint8Array,
): string {
  if (filename.toLowerCase().endsWith(".json")) {
    const text =
      typeof content === "string"
        ? content
        : new TextDecoder("utf-8", { fatal: false }).decode(content);
    try {
      const parsed = JSON.parse(text) as unknown;
      return JSON.stringify(parsed, null, 2).slice(0, 12_000);
    } catch {
      return text.slice(0, 12_000);
    }
  }

  const bytes =
    content instanceof Uint8Array
      ? content
      : new TextEncoder().encode(content);
  const size = bytes.byteLength;
  const magic = String.fromCharCode(...bytes.slice(0, 4));
  const { player, opponent } = parseReplayFilename(filename);
  const printable = extractPrintableAscii(bytes);

  const header = [
    `Replay file: ${filename}`,
    `Format: ${magic === "yrpX" || magic === "YRPX" ? "EDOPro yrpX (compressed binary)" : "binary replay"}`,
    `Size: ${size} bytes`,
    player || opponent
      ? `Matchup from filename: ${player ?? "?"} vs ${opponent ?? "?"}`
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  if (printable.length < 40) {
    return `${header}\nLimited inline text in this binary replay; coach will use matchup context plus the filename.`;
  }
  return `${header}\nExtracted text fragments:\n${printable.slice(0, 8_000)}`;
}
