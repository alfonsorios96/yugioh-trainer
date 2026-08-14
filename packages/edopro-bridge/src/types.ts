export interface WindBotEntry {
  name: string;
  deck: string;
  difficulty: number;
  masterRules: number[];
}

export interface RivalProfile {
  id: string;
  name: string;
  archetype: string;
  difficulty: number;
  windbotDeck: string;
  windbotName: string;
  masterRules: number[];
  notes: string;
  lessonId: string;
}

export interface YdkDeck {
  name: string;
  path: string;
  main: number[];
  extra: number[];
  side: number[];
}

export interface EdoProInstallInfo {
  rootPath: string;
  valid: boolean;
  hasWindBot: boolean;
  hasCardsDb: boolean;
  windBotPath: string | null;
  botsJsonPath: string | null;
  deckDir: string | null;
  replayDir: string | null;
  executablePath: string | null;
  issues: string[];
}

export interface LaunchDuelOptions {
  edoProRoot: string;
  rival: RivalProfile;
  playerDeckPath?: string;
  host?: string;
  port?: number;
  botName?: string;
}

export interface LaunchPlan {
  steps: string[];
  windBotArgs: string[];
  windBotCwd: string;
  windBotExecutableCandidates: string[];
  edoProExecutableCandidates: string[];
  host: string;
  port: number;
  rivalDeck: string;
  rivalName: string;
}

export interface ReplayFileInfo {
  path: string;
  name: string;
  modifiedMs: number;
  size: number;
}
