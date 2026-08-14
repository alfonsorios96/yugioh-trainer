import type { EnginePatch } from "./types.js";
import {
  formatSelectArgs,
  parseCsConsts,
  parseHandlers,
  type HandlerInfo,
} from "./compile.js";

function applyOne(source: string, patch: EnginePatch): string {
  const consts = parseCsConsts(source);
  const handlers = parseHandlers(source, consts);
  const handler = handlers.find((h) => h.cardIds.includes(patch.cardId));
  if (!handler) return source;
  const calls = handler.calls.filter((c) => c.kind === patch.kind);
  const idx = patch.callIndex ?? 0;
  const call = calls[idx];
  if (!call) {
    return insertSelectCall(source, handler, patch, consts);
  }
  const args = formatSelectArgs(patch.ids, consts);
  return source.slice(0, call.argsStart) + args + source.slice(call.argsEnd);
}

function insertSelectCall(
  source: string,
  handler: HandlerInfo,
  patch: EnginePatch,
  consts: ReturnType<typeof parseCsConsts>,
): string {
  const method = patch.kind === "selectNextCard" ? "SelectNextCard" : "SelectCard";
  const args = formatSelectArgs(patch.ids, consts);
  const line = `\n                ex.Brain.${method}(${args});`;
  const insertAt = handler.bodyEnd;
  return source.slice(0, insertAt) + line + source.slice(insertAt);
}

/** Apply SelectCard / SelectNextCard patches from last to first so offsets stay valid. */
export function applyEnginePatches(source: string, patches: EnginePatch[]): string {
  if (patches.length === 0) return source;
  const ranked = [...patches].sort((a, b) => {
    if (a.cardId !== b.cardId) return b.cardId - a.cardId;
    return (b.callIndex ?? 0) - (a.callIndex ?? 0);
  });
  let next = source;
  for (const patch of ranked) {
    next = applyOne(next, patch);
  }
  return next;
}

export function patchesAreSelectOnly(patches: EnginePatch[]): boolean {
  return patches.every(
    (p) => p.kind === "selectCard" || p.kind === "selectNextCard",
  );
}
