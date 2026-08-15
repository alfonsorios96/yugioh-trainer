import {
  defaultInstallHints,
  officialCardDbCandidates,
  probeEdoProInstallAsync,
  type EdoProInstallInfo,
} from "@yugioh/edopro-bridge";
import { joinPath, native } from "./native";

export async function probeInstall(rootPath: string): Promise<EdoProInstallInfo> {
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
    const info = await probeInstall(hint);
    if (info.valid || info.executablePath) found.push(hint);
  }
  return found;
}

export async function findRepoEnginesRoot(): Promise<string | null> {
  const starts: string[] = [];
  try {
    starts.push(await native.currentDir());
  } catch {
    /* ignore */
  }
  try {
    starts.push(await native.homeDir());
  } catch {
    /* ignore */
  }

  const seen = new Set<string>();
  for (const start of starts) {
    let dir = start.replace(/\\/g, "/");
    for (let i = 0; i < 10; i++) {
      if (seen.has(dir)) break;
      seen.add(dir);
      const candidate = joinPath(dir, "packages", "windbot-engines");
      const book = joinPath(candidate, "combos", "toon-2026", "book.json");
      if ((await native.pathStat(book)).exists) return candidate;
      const parent = dir.replace(/\/+$/, "").split("/").slice(0, -1).join("/") || "/";
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

export function comboDir(enginesRoot: string): string {
  return joinPath(enginesRoot, "combos", "toon-2026");
}

export function bookPath(enginesRoot: string): string {
  return joinPath(comboDir(enginesRoot), "book.json");
}

export function modelPath(enginesRoot: string): string {
  return joinPath(comboDir(enginesRoot), "model.json");
}

export function logPath(enginesRoot: string): string {
  return joinPath(comboDir(enginesRoot), "learning-log.jsonl");
}

export async function resolveCdb(edoProRoot: string): Promise<string | null> {
  const candidates = officialCardDbCandidates(edoProRoot, joinPath);
  for (const p of candidates) {
    if ((await native.pathStat(p)).exists) return p;
  }
  return null;
}
