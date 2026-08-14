import type { EdoProInstallInfo } from "./types.js";

export interface PathProbe {
  exists: (path: string) => boolean;
  isFile?: (path: string) => boolean;
  isDir?: (path: string) => boolean;
  join: (...parts: string[]) => string;
}

const MAC_EXECUTABLE_NAMES = [
  "EDOPro",
  "edopro",
  "ProjectIgnis",
  "YGOPRO",
];

const WIN_EXECUTABLE_NAMES = ["EDOPro.exe", "edopro.exe", "YGOPRO.exe"];

const LINUX_EXECUTABLE_NAMES = ["EDOPro", "edopro", "ygopro"];

function candidateExecutables(root: string, join: PathProbe["join"]): string[] {
  const platform =
    typeof navigator !== "undefined"
      ? navigator.platform.toLowerCase()
      : processPlatform();

  const names = platform.includes("win")
    ? WIN_EXECUTABLE_NAMES
    : platform.includes("linux")
      ? LINUX_EXECUTABLE_NAMES
      : MAC_EXECUTABLE_NAMES;

  const out: string[] = [];
  for (const name of names) {
    out.push(join(root, name));
    out.push(join(root, "bin", name));
  }
  // macOS app bundle patterns
  out.push(join(root, "EDOPro.app", "Contents", "MacOS", "EDOPro"));
  out.push(join(root, "Project Ignis - EDOPro.app", "Contents", "MacOS", "EDOPro"));
  return out;
}

function processPlatform(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (globalThis as any).process?.platform as string | undefined;
    return (p ?? "darwin").toLowerCase();
  } catch {
    return "darwin";
  }
}

export interface AsyncPathProbe {
  exists: (path: string) => Promise<boolean>;
  join: (...parts: string[]) => string;
}

async function someExists(
  paths: string[],
  exists: (path: string) => Promise<boolean>,
): Promise<boolean> {
  for (const p of paths) {
    if (await exists(p)) return true;
  }
  return false;
}

/**
 * Probe a candidate EDOPro install directory.
 * Pure relative to injected filesystem checks (Tauri fs / Node fs).
 */
export function probeEdoProInstall(
  rootPath: string,
  probe: PathProbe,
): EdoProInstallInfo {
  // Sync wrapper kept for unit tests / Node; prefer probeEdoProInstallAsync in apps.
  const cache = new Map<string, boolean>();
  const existsCached = (p: string) => {
    if (!cache.has(p)) cache.set(p, probe.exists(p));
    return cache.get(p)!;
  };
  // Intentionally call through a blocking facade — callers must supply sync exists.
  return buildInstallInfo(rootPath, probe.join, existsCached);
}

export async function probeEdoProInstallAsync(
  rootPath: string,
  probe: AsyncPathProbe,
): Promise<EdoProInstallInfo> {
  const cache = new Map<string, boolean>();
  const exists = async (p: string) => {
    if (!cache.has(p)) cache.set(p, await probe.exists(p));
    return cache.get(p)!;
  };
  return buildInstallInfoAsync(rootPath, probe.join, exists);
}

function buildInstallInfo(
  rootPath: string,
  join: PathProbe["join"],
  exists: (path: string) => boolean,
): EdoProInstallInfo {
  const issues: string[] = [];
  const normalized = rootPath.replace(/[/\\]+$/, "");

  if (!normalized) {
    return emptyInfo("", ["No EDOPro path configured."]);
  }

  if (!exists(normalized)) {
    return emptyInfo(normalized, [`Path does not exist: ${normalized}`]);
  }

  const windBotPath = join(normalized, "WindBot");
  const botsJsonPath = join(windBotPath, "bots.json");
  const hasWindBot = exists(windBotPath);
  const hasBotsJson = exists(botsJsonPath);

  const cardsCandidates = officialCardDbCandidates(normalized, join);
  const hasCardsDb = cardsCandidates.some((p) => exists(p));

  const deckDir = join(normalized, "deck");
  const replayDir = join(normalized, "replay");

  let executablePath: string | null = null;
  for (const candidate of candidateExecutables(normalized, join)) {
    if (exists(candidate)) {
      executablePath = candidate;
      break;
    }
  }

  if (!hasWindBot) issues.push("WindBot folder not found (expected ./WindBot).");
  if (!hasBotsJson) issues.push("WindBot/bots.json not found.");
  if (!hasCardsDb) issues.push("No cards database found (cards.cdb).");
  if (!executablePath) {
    issues.push(
      "EDOPro executable not found in install root (you can still launch manually).",
    );
  }
  if (!exists(deckDir)) issues.push("deck/ folder missing.");

  return {
    rootPath: normalized,
    valid: hasWindBot && hasBotsJson,
    hasWindBot,
    hasCardsDb,
    windBotPath: hasWindBot ? windBotPath : null,
    botsJsonPath: hasBotsJson ? botsJsonPath : null,
    deckDir: exists(deckDir) ? deckDir : null,
    replayDir: exists(replayDir) ? replayDir : join(normalized, "replay"),
    executablePath,
    issues,
  };
}

async function buildInstallInfoAsync(
  rootPath: string,
  join: PathProbe["join"],
  exists: (path: string) => Promise<boolean>,
): Promise<EdoProInstallInfo> {
  const issues: string[] = [];
  const normalized = rootPath.replace(/[/\\]+$/, "");

  if (!normalized) {
    return emptyInfo("", ["No EDOPro path configured."]);
  }

  if (!(await exists(normalized))) {
    return emptyInfo(normalized, [`Path does not exist: ${normalized}`]);
  }

  const windBotPath = join(normalized, "WindBot");
  const botsJsonPath = join(windBotPath, "bots.json");
  const hasWindBot = await exists(windBotPath);
  const hasBotsJson = await exists(botsJsonPath);

  const cardsCandidates = officialCardDbCandidates(normalized, join);
  const hasCardsDb = await someExists(cardsCandidates, exists);

  const deckDir = join(normalized, "deck");
  const replayDir = join(normalized, "replay");
  const hasDeckDir = await exists(deckDir);
  const hasReplayDir = await exists(replayDir);

  let executablePath: string | null = null;
  for (const candidate of candidateExecutables(normalized, join)) {
    if (await exists(candidate)) {
      executablePath = candidate;
      break;
    }
  }

  if (!hasWindBot) issues.push("WindBot folder not found (expected ./WindBot).");
  if (!hasBotsJson) issues.push("WindBot/bots.json not found.");
  if (!hasCardsDb) issues.push("No cards database found (cards.cdb).");
  if (!executablePath) {
    issues.push(
      "EDOPro executable not found in install root (you can still launch manually).",
    );
  }
  if (!hasDeckDir) issues.push("deck/ folder missing.");

  return {
    rootPath: normalized,
    valid: hasWindBot && hasBotsJson,
    hasWindBot,
    hasCardsDb,
    windBotPath: hasWindBot ? windBotPath : null,
    botsJsonPath: hasBotsJson ? botsJsonPath : null,
    deckDir: hasDeckDir ? deckDir : null,
    replayDir: hasReplayDir ? replayDir : join(normalized, "replay"),
    executablePath,
    issues,
  };
}

function emptyInfo(rootPath: string, issues: string[]): EdoProInstallInfo {
  return {
    rootPath,
    valid: false,
    hasWindBot: false,
    hasCardsDb: false,
    windBotPath: null,
    botsJsonPath: null,
    deckDir: null,
    replayDir: null,
    executablePath: null,
    issues,
  };
}

/** Official EDOPro card databases, in lookup order. */
export function officialCardDbCandidates(
  root: string,
  join: PathProbe["join"],
): string[] {
  return [
    join(root, "expansions", "cards.cdb"),
    join(root, "cards.cdb"),
    join(root, "repositories", "delta", "cards.delta.cdb"),
  ];
}

/** Common macOS / user-hinted locations (hints only; not auto-scanned deeply). */
export function defaultInstallHints(join: PathProbe["join"], home: string): string[] {
  return [
    join(home, "ProjectIgnis"),
    join(home, "EDOPro"),
    join(home, "Applications", "ProjectIgnis"),
    join(home, "Games", "ProjectIgnis"),
    join(home, "Games", "EDOPro"),
    "/Applications/ProjectIgnis",
    "/Applications/EDOPro",
  ];
}
