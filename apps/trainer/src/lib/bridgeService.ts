import {
  analyzeWindBotInventory,
  applyCardNames,
  replaceHashCodes,
  buildLaunchPlan,
  decodeBase64Bytes,
  defaultInstallHints,
  extractReplaySummaryText,
  isReplayFilename,
  mergeBotsJson,
  META_PLUGIN_DECKS,
  parseBotsJson,
  parseYdk,
  parseYrpxWalkthrough,
  pickLatestReplay,
  probeEdoProInstallAsync,
  stringifyBotsJson,
  validateYdkStructure,
  type EdoProInstallInfo,
  type LaunchPlan,
  type ReplayFileInfo,
  type ReplayWalkthrough,
  type RivalProfile,
  type WindBotEntry,
  type UnknownCardMeta,
  type WindBotInventoryAnalysis,
  type YdkDeck,
} from "@yugioh/edopro-bridge";
import { resolveCardCatalog } from "./cardCatalog";
import { joinPath, native } from "./native";

export type { WindBotInventoryAnalysis };

export async function probeInstallAsync(rootPath: string): Promise<EdoProInstallInfo> {
  return probeEdoProInstallAsync(rootPath, {
    exists: async (p) => (await native.pathStat(p)).exists,
    join: joinPath,
  });
}

export async function suggestInstallPaths(): Promise<string[]> {
  const home = await native.homeDir();
  const hints = defaultInstallHints(joinPath, home);
  const found: string[] = [];
  for (const hint of hints) {
    const info = await probeInstallAsync(hint);
    if (info.valid || info.executablePath) found.push(hint);
  }
  return found;
}

export async function syncRivalBots(
  install: EdoProInstallInfo,
  rivalList: RivalProfile[],
  engineYdks?: { fileName: string; contents: string }[],
): Promise<{ added: string[]; updated: string[]; engines: string[] }> {
  if (!install.botsJsonPath) {
    throw new Error("bots.json path not available");
  }
  const raw = await native.readTextFile(install.botsJsonPath);
  const existing = parseBotsJson(raw);
  const { bots, added, updated } = mergeBotsJson(existing, rivalList);
  await native.writeTextFile(install.botsJsonPath, stringifyBotsJson(bots));
  const engines = engineYdks?.length
    ? await installMetaEngineYdks(install, engineYdks)
    : [];
  return { added, updated, engines };
}

/** Write bundled META engine .ydk files into WindBot/Decks. */
export async function installMetaEngineYdks(
  install: EdoProInstallInfo,
  files: { fileName: string; contents: string }[],
): Promise<string[]> {
  if (!install.windBotPath) {
    throw new Error("WindBot path not available");
  }
  const decksDir = joinPath(install.windBotPath, "Decks");
  const written: string[] = [];
  for (const file of files) {
    const dest = joinPath(decksDir, file.fileName);
    await native.writeTextFile(dest, file.contents);
    written.push(file.fileName);
  }
  return written;
}

export async function listYdkDecks(deckDir: string): Promise<YdkDeck[]> {
  const entries = await native.listDir(deckDir);
  const decks: YdkDeck[] = [];
  for (const entry of entries) {
    if (!entry.isFile || !entry.name.toLowerCase().endsWith(".ydk")) continue;
    try {
      const content = await native.readTextFile(entry.path);
      const deck = parseYdk(content, entry.name.replace(/\.ydk$/i, ""), entry.path);
      decks.push(deck);
    } catch {
      // skip unreadable
    }
  }
  return decks;
}

export async function importYdkToInstall(
  sourcePath: string,
  deckDir: string,
): Promise<YdkDeck> {
  const content = await native.readTextFile(sourcePath);
  const name =
    sourcePath.split(/[/\\]/).pop()?.replace(/\.ydk$/i, "") ?? "imported";
  const deck = parseYdk(content, name, sourcePath);
  const issues = validateYdkStructure(deck);
  if (issues.length && deck.main.length === 0) {
    throw new Error(issues.join(" "));
  }
  const dest = joinPath(deckDir, `${name}.ydk`);
  await native.copyFile(sourcePath, dest);
  return { ...deck, path: dest };
}

export function createLaunchPlan(
  edoProRoot: string,
  rival: RivalProfile,
  playerDeckPath: string | undefined,
  host: string,
  port: number,
): LaunchPlan {
  return buildLaunchPlan({
    edoProRoot,
    rival,
    playerDeckPath,
    host,
    port,
  });
}

export async function startTrainingDuel(plan: LaunchPlan): Promise<{
  edo: Awaited<ReturnType<typeof native.launchExecutable>>;
  windbot: Awaited<ReturnType<typeof native.launchWindbot>>;
}> {
  const edo = await native.launchExecutable(plan.edoProExecutableCandidates, []);
  const windbot = await native.launchWindbot(plan.windBotCwd, plan.windBotArgs);
  return { edo, windbot };
}

export async function listReplays(replayDir: string): Promise<ReplayFileInfo[]> {
  try {
    const entries = await native.listDir(replayDir);
    return entries
      .filter((e) => e.isFile && isReplayFilename(e.name))
      .map((e) => ({
        path: e.path,
        name: e.name,
        modifiedMs: e.modifiedMs,
        size: e.size,
      }));
  } catch {
    return [];
  }
}

export async function getLatestReplayFile(
  replayDir: string,
): Promise<ReplayFileInfo | null> {
  return pickLatestReplay(await listReplays(replayDir));
}

export function replayArtPaths(edoProRoot: string): {
  picsDir: string;
  unknownPic: string;
} {
  return {
    picsDir: joinPath(edoProRoot, "pics"),
    unknownPic: joinPath(edoProRoot, "textures", "unknown.jpg"),
  };
}

export async function loadWalkthroughForFile(
  file: ReplayFileInfo,
  edoProRoot: string,
): Promise<{
  file: ReplayFileInfo;
  walk: ReplayWalkthrough;
  names: Record<string, string>;
  unknownMeta: Record<string, UnknownCardMeta>;
  picsDir: string;
  unknownPic: string;
}> {
  const b64 = await native.decompressYrpx(file.path);
  const walk = parseYrpxWalkthrough(decodeBase64Bytes(b64), file.name);
  let names: Record<string, string> = {};
  let unknownMeta: Record<string, UnknownCardMeta> = {};
  try {
    const resolved = await resolveCardCatalog(edoProRoot, walk.cardCodes);
    names = resolved.names;
    unknownMeta = resolved.unknownMeta;
  } catch {
    names = {};
    unknownMeta = {};
  }
  walk.steps = walk.steps.map((step) => ({
    ...step,
    chosen: replaceHashCodes(
      applyCardNames(step.chosen, step.cardCodes, names),
      names,
    ),
  }));
  return {
    file,
    walk,
    names,
    unknownMeta,
    ...replayArtPaths(edoProRoot),
  };
}

export async function loadLatestWalkthrough(
  replayDir: string,
  edoProRoot: string,
): Promise<{
  file: ReplayFileInfo;
  walk: ReplayWalkthrough;
  names: Record<string, string>;
  unknownMeta: Record<string, UnknownCardMeta>;
  picsDir: string;
  unknownPic: string;
} | null> {
  const latest = await getLatestReplayFile(replayDir);
  if (!latest) return null;
  return loadWalkthroughForFile(latest, edoProRoot);
}

export async function loadLatestReplayText(
  replayDir: string,
): Promise<{ file: ReplayFileInfo; text: string } | null> {
  const files = await listReplays(replayDir);
  const latest = pickLatestReplay(files);
  if (!latest) return null;
  const isJson = latest.name.toLowerCase().endsWith(".json");
  const content = isJson
    ? await native.readTextFile(latest.path)
    : new Uint8Array(await native.readBinaryFile(latest.path));
  return {
    file: latest,
    text: extractReplaySummaryText(latest.name, content),
  };
}

async function listFileNames(dir: string | null): Promise<string[]> {
  if (!dir) return [];
  try {
    const entries = await native.listDir(dir);
    return entries.filter((e) => e.isFile).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Scan WindBot install: bots.json + Decks/*.ydk + Executors, vs training rivals. */
export async function analyzeWindBotDecks(
  install: EdoProInstallInfo,
  trainingRivals: RivalProfile[],
): Promise<WindBotInventoryAnalysis> {
  const windBotPath = install.windBotPath;
  const botsJsonPath = install.botsJsonPath;
  const decksDir = windBotPath ? joinPath(windBotPath, "Decks") : null;
  const executorsDir = windBotPath ? joinPath(windBotPath, "Executors") : null;

  let bots: WindBotEntry[] = [];
  if (botsJsonPath) {
    try {
      bots = parseBotsJson(await native.readTextFile(botsJsonPath));
    } catch {
      bots = [];
    }
  }

  const decksDirExists = decksDir
    ? (await native.pathStat(decksDir)).exists
    : false;
  const executorsDirExists = executorsDir
    ? (await native.pathStat(executorsDir)).exists
    : false;

  const ydkFileNames = (await listFileNames(decksDirExists ? decksDir : null)).filter(
    (n) => n.toLowerCase().endsWith(".ydk"),
  );
  const executorFileNames = await listFileNames(
    executorsDirExists ? executorsDir : null,
  );
  let engineMarkerPresent = false;
  if (executorsDirExists && executorsDir) {
    try {
      const markerRaw = await native.readTextFile(
        joinPath(executorsDir, ".ygo-trainer-engines.json"),
      );
      const marker = JSON.parse(markerRaw) as { compile?: string; dll?: string | null };
      engineMarkerPresent = marker.compile === "ok" || Boolean(marker.dll);
    } catch {
      engineMarkerPresent = false;
    }
  }

  return analyzeWindBotInventory({
    botsJsonPath,
    decksDir: decksDirExists ? decksDir : null,
    executorsDir: executorsDirExists ? executorsDir : null,
    bots,
    ydkFileNames,
    executorFileNames,
    trainingRivals,
    pluginDeckKeys: META_PLUGIN_DECKS,
    engineMarkerPresent,
  });
}
