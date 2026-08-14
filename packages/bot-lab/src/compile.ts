import type { ComboBook, EnginePatch } from "./types.js";
import { allSelectExpectations } from "./book.js";

export interface CsConstMap {
  byQualified: Map<string, number>;
  byName: Map<string, number>;
  idToQualified: Map<number, string>;
}

export interface SelectCall {
  kind: "selectCard" | "selectNextCard";
  ids: number[];
  start: number;
  end: number;
  argsStart: number;
  argsEnd: number;
}

export interface HandlerInfo {
  name: string;
  cardIds: number[];
  bodyStart: number;
  bodyEnd: number;
  calls: SelectCall[];
}

export function parseCsConsts(source: string): CsConstMap {
  const byQualified = new Map<string, number>();
  const byName = new Map<string, number>();
  const idToQualified = new Map<number, string>();
  const classRe = /(?:public\s+)?static\s+class\s+(\w+)\s*\{/g;
  let classMatch: RegExpExecArray | null;
  const classes: { name: string; start: number }[] = [];
  while ((classMatch = classRe.exec(source))) {
    classes.push({ name: classMatch[1], start: classMatch.index });
  }
  const constRe = /public const int (\w+)\s*=\s*(\d+)\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = constRe.exec(source))) {
    const name = m[1];
    const id = Number(m[2]);
    byName.set(name, id);
    let className = "";
    for (const c of classes) {
      if (c.start < m.index) className = c.name;
    }
    if (className) {
      const q = `${className}.${name}`;
      byQualified.set(q, id);
      if (!idToQualified.has(id)) idToQualified.set(id, q);
    }
  }
  return { byQualified, byName, idToQualified };
}

function matchingBrace(source: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function matchingParen(source: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function resolveArgIds(args: string, consts: CsConstMap): number[] {
  const ids: number[] = [];
  const tokenRe = /(\w+)\.(\w+)/g;
  let t: RegExpExecArray | null;
  while ((t = tokenRe.exec(args))) {
    const id =
      consts.byQualified.get(`${t[1]}.${t[2]}`) ?? consts.byName.get(t[2]);
    if (id) ids.push(id);
  }
  const numRe = /\b(\d{4,8})\b/g;
  let n: RegExpExecArray | null;
  while ((n = numRe.exec(args))) ids.push(Number(n[1]));
  return [...new Set(ids)];
}

function parseSelectCallsIn(
  source: string,
  from: number,
  to: number,
  consts: CsConstMap,
): SelectCall[] {
  const slice = source.slice(from, to);
  const calls: SelectCall[] = [];
  const re = /Brain\.Select(Next|Third)?Card\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice))) {
    const absOpen = from + m.index + m[0].length - 1;
    const close = matchingParen(source, absOpen);
    if (close < 0) continue;
    const args = source.slice(absOpen + 1, close);
    const kind: SelectCall["kind"] =
      m[1] === "Next" || m[1] === "Third" ? "selectNextCard" : "selectCard";
    calls.push({
      kind,
      ids: resolveArgIds(args, consts),
      start: from + m.index,
      end: close + 1,
      argsStart: absOpen + 1,
      argsEnd: close,
    });
  }
  return calls;
}

export function parseHandlers(source: string, extraConsts?: CsConstMap): HandlerInfo[] {
  const consts = extraConsts ?? parseCsConsts(source);
  const bindToFn = new Map<string, number[]>();
  const bindRe =
    /(?:ex\.)?Bind\(\s*ExecutorType\.\w+\s*,\s*(?:(\w+)\.(\w+)|(\d+))\s*,\s*(\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = bindRe.exec(source))) {
    const fn = m[4];
    const id = m[3]
      ? Number(m[3])
      : (consts.byQualified.get(`${m[1]}.${m[2]}`) ?? consts.byName.get(m[2]));
    if (!id) continue;
    const list = bindToFn.get(fn) ?? [];
    if (!list.includes(id)) list.push(id);
    bindToFn.set(fn, list);
  }

  const handlers: HandlerInfo[] = [];
  const fnRe = /static Func<bool> (\w+)\s*\(/g;
  while ((m = fnRe.exec(source))) {
    const name = m[1];
    const brace = source.indexOf("{", m.index);
    if (brace < 0) continue;
    const end = matchingBrace(source, brace);
    if (end < 0) continue;
    handlers.push({
      name,
      cardIds: bindToFn.get(name) ?? [],
      bodyStart: brace,
      bodyEnd: end,
      calls: parseSelectCallsIn(source, brace, end + 1, consts),
    });
  }
  return handlers;
}

export function allSelectIds(source: string): Set<number> {
  const handlers = parseHandlers(source);
  const ids = new Set<number>();
  for (const h of handlers) {
    for (const c of h.calls) for (const id of c.ids) ids.add(id);
  }
  return ids;
}

export function formatSelectArgs(ids: number[], consts: CsConstMap): string {
  const names = ids.map((id) => consts.idToQualified.get(id) ?? String(id));
  if (names.length <= 3) return names.join(", ");
  return `\n                    ${names.join(",\n                    ")}`;
}

function uniqueKeepOrder(ids: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sameIds(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Merge gold situation SelectCard lists into existing handler lists.
 * New IDs are prepended; existing IDs are never dropped (no-regression).
 */
export function compileComboBook(
  book: ComboBook,
  engineSource: string,
): EnginePatch[] {
  const handlers = parseHandlers(engineSource);
  const expectations = allSelectExpectations(book);
  const patches: EnginePatch[] = [];

  for (const exp of expectations) {
    const handler = handlers.find((h) => h.cardIds.includes(exp.cardId));
    if (!handler) continue;
    if (exp.selectCard.length) {
      const calls = handler.calls.filter((c) => c.kind === "selectCard");
      const first = calls[0];
      const existing = first?.ids ?? [];
      const merged = uniqueKeepOrder([...exp.selectCard, ...existing]);
      if (!sameIds(merged, existing)) {
        patches.push({
          kind: "selectCard",
          cardId: exp.cardId,
          ids: merged,
          callIndex: 0,
        });
      }
    }
    if (exp.selectNextCard.length) {
      const calls = handler.calls.filter((c) => c.kind === "selectNextCard");
      const first = calls[0];
      const existing = first?.ids ?? [];
      const merged = uniqueKeepOrder([...exp.selectNextCard, ...existing]);
      if (!sameIds(merged, existing)) {
        patches.push({
          kind: "selectNextCard",
          cardId: exp.cardId,
          ids: merged,
          callIndex: 0,
        });
      }
    }
  }
  return patches;
}

export function currentPatchesFromSource(engineSource: string): EnginePatch[] {
  const handlers = parseHandlers(engineSource);
  const out: EnginePatch[] = [];
  for (const h of handlers) {
    for (const cardId of h.cardIds) {
      h.calls.forEach((c, i) => {
        if (c.ids.length === 0) return;
        out.push({
          kind: c.kind,
          cardId,
          ids: c.ids,
          callIndex: i,
        });
      });
    }
  }
  return out;
}

export function undoPatchesFor(
  engineSource: string,
  patches: EnginePatch[],
): EnginePatch[] {
  const handlers = parseHandlers(engineSource);
  return patches.map((p) => {
    const handler = handlers.find((h) => h.cardIds.includes(p.cardId));
    const calls = (handler?.calls ?? []).filter((c) => c.kind === p.kind);
    const idx = p.callIndex ?? 0;
    return {
      kind: p.kind,
      cardId: p.cardId,
      ids: calls[idx]?.ids ?? [],
      callIndex: idx,
    };
  });
}

export function validateNoRegression(
  book: ComboBook,
  engineSource: string,
): { ok: boolean; missing: { situationId: string; cardId: number; id: number }[] } {
  const present = allSelectIds(engineSource);
  const missing: { situationId: string; cardId: number; id: number }[] = [];
  for (const sit of book.situations) {
    for (const step of sit.steps) {
      for (const id of [...(step.selectCard ?? []), ...(step.selectNextCard ?? [])]) {
        if (!present.has(id)) {
          missing.push({ situationId: sit.situationId, cardId: step.cardId, id });
        }
      }
    }
  }
  return { ok: missing.length === 0, missing };
}
