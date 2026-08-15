import type { RivalProfile, WindBotEntry } from "./types.js";

export type RivalDeckStatus =
  | "ready"
  | "listed_no_ydk"
  | "missing"
  | "missing_executor";

/** Deck= keys that need YgoTrainerEngines.dll (not built into stock WindBot). */
export const META_PLUGIN_DECKS = ["Toon2026Agent"];

export interface WindBotDeckAvailability {
  botName: string;
  deckKey: string;
  difficulty: number;
  masterRules: number[];
  hasYdk: boolean;
  ydkFileName: string | null;
  hasExecutorDll: boolean;
  executorFileName: string | null;
}

export interface TrainingRivalReadiness {
  rivalId: string;
  rivalName: string;
  windbotName: string;
  windbotDeck: string;
  status: RivalDeckStatus;
  inBotsJson: boolean;
  hasYdk: boolean;
  ydkFileName: string | null;
  needsPluginExecutor: boolean;
  hasPluginExecutor: boolean;
  note: string;
}

export interface WindBotInventoryAnalysis {
  botsJsonPath: string | null;
  decksDir: string | null;
  executorsDir: string | null;
  totalBots: number;
  totalYdkFiles: number;
  totalExecutorDlls: number;
  byDifficulty: Record<string, number>;
  availableDecks: WindBotDeckAvailability[];
  trainingRivals: TrainingRivalReadiness[];
  trainingReadyCount: number;
  trainingMissingCount: number;
  ready: boolean;
  summary: string;
  issues: string[];
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** Candidate .ydk basenames for a WindBot deck key (AI_ prefix is common). */
export function ydkCandidatesForDeck(deckKey: string): string[] {
  const raw = deckKey.trim();
  const noSpaces = raw.replace(/\s+/g, "");
  const underscored = raw.replace(/\s+/g, "_");
  const variants = new Set<string>([
    `${raw}.ydk`,
    `${noSpaces}.ydk`,
    `${underscored}.ydk`,
    `AI_${raw}.ydk`,
    `AI_${noSpaces}.ydk`,
    `AI_${underscored}.ydk`,
    `AI-${raw}.ydk`,
    `AI-${noSpaces}.ydk`,
  ]);
  return [...variants];
}

export function findMatchingYdk(
  deckKey: string,
  ydkFileNames: string[],
): string | null {
  const lowerMap = new Map(ydkFileNames.map((n) => [n.toLowerCase(), n]));
  for (const candidate of ydkCandidatesForDeck(deckKey)) {
    const hit = lowerMap.get(candidate.toLowerCase());
    if (hit) return hit;
  }
  // Loose match: file contains deck key without AI_/ext
  const needle = normalizeKey(deckKey);
  for (const name of ydkFileNames) {
    const stem = normalizeKey(name.replace(/\.ydk$/i, "").replace(/^ai[_-]?/i, ""));
    if (stem === needle) return name;
  }
  return null;
}

export function findMatchingExecutor(
  deckKey: string,
  executorFileNames: string[],
): string | null {
  const needle = normalizeKey(deckKey);
  const isPlugin = META_PLUGIN_DECKS.some((k) => normalizeKey(k) === needle);
  for (const name of executorFileNames) {
    if (!name.toLowerCase().endsWith(".dll")) continue;
    const stem = normalizeKey(name.replace(/\.dll$/i, ""));
    if (isPlugin && stem.includes("ygotrainerengines")) return name;
    if (stem.includes(needle) || needle.includes(stem)) return name;
  }
  return null;
}

export function analyzeWindBotInventory(input: {
  botsJsonPath: string | null;
  decksDir: string | null;
  executorsDir: string | null;
  bots: WindBotEntry[];
  ydkFileNames: string[];
  executorFileNames: string[];
  trainingRivals: RivalProfile[];
  pluginDeckKeys?: string[];
  engineMarkerPresent?: boolean;
}): WindBotInventoryAnalysis {
  const issues: string[] = [];
  const byDifficulty: Record<string, number> = {};

  for (const bot of input.bots) {
    const key = String(bot.difficulty);
    byDifficulty[key] = (byDifficulty[key] ?? 0) + 1;
  }

  if (!input.botsJsonPath) issues.push("bots.json not found.");
  if (input.bots.length === 0) issues.push("No bots listed in bots.json.");
  if (!input.decksDir) issues.push("WindBot/Decks folder not found.");
  if (input.ydkFileNames.length === 0) {
    issues.push("No .ydk files in WindBot/Decks (bots may still use embedded decks).");
  }

  const availableDecks: WindBotDeckAvailability[] = input.bots.map((bot) => {
    const ydkFileName = findMatchingYdk(bot.deck, input.ydkFileNames);
    const executorFileName = findMatchingExecutor(bot.deck, input.executorFileNames);
    return {
      botName: bot.name,
      deckKey: bot.deck,
      difficulty: bot.difficulty,
      masterRules: bot.masterRules,
      hasYdk: Boolean(ydkFileName),
      ydkFileName,
      hasExecutorDll: Boolean(executorFileName),
      executorFileName,
    };
  });

  const trainingRivals: TrainingRivalReadiness[] = input.trainingRivals.map((rival) => {
    const bot =
      input.bots.find(
        (b) =>
          b.name === rival.windbotName ||
          normalizeKey(b.deck) === normalizeKey(rival.windbotDeck) ||
          normalizeKey(b.name) === normalizeKey(rival.windbotName),
      ) ?? null;
    const deckKey = bot?.deck ?? rival.windbotDeck;
    const ydkFileName = findMatchingYdk(deckKey, input.ydkFileNames);
    const inBotsJson = Boolean(bot);
    const hasYdk = Boolean(ydkFileName);
    const pluginKeys = (input.pluginDeckKeys ?? META_PLUGIN_DECKS).map((k) =>
      normalizeKey(k),
    );
    const needsPluginExecutor = pluginKeys.includes(normalizeKey(deckKey));
    const hasPluginExecutor =
      Boolean(findMatchingExecutor(deckKey, input.executorFileNames)) ||
      Boolean(input.engineMarkerPresent);

    let status: RivalDeckStatus;
    let note: string;
    if (!inBotsJson) {
      status = "missing";
      note = `Not in bots.json — use Sync WindBot bots on Train`;
    } else if (!hasYdk && input.ydkFileNames.length > 0) {
      status = "listed_no_ydk";
      note = `Listed as "${bot!.name}" but no matching .ydk for "${deckKey}"`;
    } else if (needsPluginExecutor && !hasPluginExecutor) {
      status = "missing_executor";
      note = hasYdk
        ? `YDK ${ydkFileName} is in Decks/ but WindBot has no plugin executor — run npm run install:engines`
        : `Plugin deck "${deckKey}" needs YgoTrainerEngines.dll (npm run install:engines)`;
    } else if (inBotsJson && (hasYdk || input.ydkFileNames.length === 0)) {
      status = "ready";
      note = hasYdk
        ? `Listed as "${bot!.name}" · deck file ${ydkFileName}`
        : `Listed as "${bot!.name}" · no Decks/*.ydk present (executor may be embedded)`;
    } else {
      status = "listed_no_ydk";
      note = `Listed as "${bot!.name}" but no matching .ydk for "${deckKey}"`;
    }

    return {
      rivalId: rival.id,
      rivalName: rival.name,
      windbotName: rival.windbotName,
      windbotDeck: rival.windbotDeck,
      status,
      inBotsJson,
      hasYdk,
      ydkFileName,
      needsPluginExecutor,
      hasPluginExecutor,
      note,
    };
  });

  const trainingReadyCount = trainingRivals.filter((r) => r.status === "ready").length;
  const trainingMissingCount = trainingRivals.filter((r) => r.status === "missing").length;
  const trainingExecutorMissingCount = trainingRivals.filter(
    (r) => r.status === "missing_executor",
  ).length;
  const ready =
    input.bots.length > 0 &&
    trainingReadyCount === input.trainingRivals.length &&
    trainingMissingCount === 0 &&
    trainingExecutorMissingCount === 0;

  const summary = [
    `${input.bots.length} WindBot deck(s) in bots.json`,
    `${input.ydkFileNames.length} .ydk in Decks/`,
    `Training rivals ready: ${trainingReadyCount}/${input.trainingRivals.length}`,
  ].join(" · ");

  if (trainingMissingCount > 0) {
    issues.push(
      `${trainingMissingCount} training rival(s) missing from bots.json — sync from Train.`,
    );
  }
  if (trainingExecutorMissingCount > 0) {
    issues.push(
      `${trainingExecutorMissingCount} META rival(s) need WindBot plugin executors — npm run install:engines -- <EDOPro folder>.`,
    );
  }

  return {
    botsJsonPath: input.botsJsonPath,
    decksDir: input.decksDir,
    executorsDir: input.executorsDir,
    totalBots: input.bots.length,
    totalYdkFiles: input.ydkFileNames.length,
    totalExecutorDlls: input.executorFileNames.filter((n) =>
      n.toLowerCase().endsWith(".dll"),
    ).length,
    byDifficulty,
    availableDecks,
    trainingRivals,
    trainingReadyCount,
    trainingMissingCount,
    ready,
    summary,
    issues,
  };
}
