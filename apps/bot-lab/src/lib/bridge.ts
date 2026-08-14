import {
  applyCardNames,
  decodeBase64Bytes,
  isReplayFilename,
  parseYrpxWalkthrough,
  replaceHashCodes,
  type ReplayFileInfo,
  type ReplayWalkthrough,
} from "@yugioh/edopro-bridge";
import { joinPath, native } from "./native";
import { resolveCdb } from "./paths";

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
      }))
      .sort((a, b) => b.modifiedMs - a.modifiedMs);
  } catch {
    return [];
  }
}

export async function loadWalkthrough(
  file: ReplayFileInfo,
  edoProRoot: string,
): Promise<{ walk: ReplayWalkthrough; names: Record<string, string> }> {
  const b64 = await native.decompressYrpx(file.path);
  const walk = parseYrpxWalkthrough(decodeBase64Bytes(b64), file.name);
  let names: Record<string, string> = {};
  const cdb = await resolveCdb(edoProRoot);
  if (cdb && walk.cardCodes.length) {
    try {
      names = await native.queryCardNames(cdb, walk.cardCodes);
    } catch {
      names = {};
    }
  }
  walk.steps = walk.steps.map((step) => ({
    ...step,
    chosen: replaceHashCodes(
      applyCardNames(step.chosen, step.cardCodes, names),
      names,
    ),
  }));
  return { walk, names };
}

export function cardLabel(id: number, names: Record<string, string>): string {
  return names[String(id)] ?? `#${id}`;
}

export { joinPath };
