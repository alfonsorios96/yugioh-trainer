import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const pkgRoot = join(here, "../..");

export function parseYdk(filePath) {
  const text = readFileSync(filePath, "utf8");
  const ids = new Set();
  let section = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#created")) continue;
    if (line === "#main" || line === "#extra" || line === "!side") {
      section = line;
      continue;
    }
    if (line.startsWith("#") || line.startsWith("!")) continue;
    const id = Number(line);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  return { ids, section };
}

export function uniqueYdkIds(filePath) {
  return parseYdk(filePath).ids;
}

export function parseConsts(csText) {
  const map = new Map();
  const re = /public const int (\w+)\s*=\s*(\d+)\s*;/g;
  let m;
  while ((m = re.exec(csText))) {
    map.set(m[1], Number(m[2]));
    map.set(`${m[1]}`, Number(m[2]));
  }
  return map;
}

export function parseEngineConsts(enginesDir) {
  const byName = new Map();
  const byQualified = new Map();
  for (const name of readdirSync(enginesDir).filter((f) => f.endsWith(".cs"))) {
    const text = readFileSync(join(enginesDir, name), "utf8");
    const classMatch = text.match(/public static class (\w+CardId)/);
    const className = classMatch ? classMatch[1] : null;
    const re = /public const int (\w+)\s*=\s*(\d+)\s*;/g;
    let m;
    while ((m = re.exec(text))) {
      const id = Number(m[2]);
      byName.set(m[1], id);
      if (className) byQualified.set(`${className}.${m[1]}`, id);
    }
  }
  return { byName, byQualified };
}

export function parseBinds(csText, consts) {
  const ids = new Set();
  const bindRe =
    /(?:ex\.)?Bind\(\s*ExecutorType\.\w+\s*,\s*(?:(\w+)\.(\w+)|(\d+))/g;
  let m;
  while ((m = bindRe.exec(csText))) {
    if (m[3]) {
      ids.add(Number(m[3]));
      continue;
    }
    const qualified = `${m[1]}.${m[2]}`;
    const id = consts.byQualified.get(qualified) ?? consts.byName.get(m[2]);
    if (id) ids.add(id);
  }
  const extraRe = /BindExtra\(\s*\w+\s*,\s*(\w+)\.(\w+)\s*\)/g;
  while ((m = extraRe.exec(csText))) {
    const qualified = `${m[1]}.${m[2]}`;
    const id = consts.byQualified.get(qualified) ?? consts.byName.get(m[2]);
    if (id) ids.add(id);
  }
  return ids;
}

export function parseSelectCardIds(csText, consts) {
  const ids = new Set();
  const callRe = /Brain\.Select(?:Next|Third)?Card\(([^)]*)\)/g;
  let m;
  while ((m = callRe.exec(csText))) {
    const args = m[1];
    const tokenRe = /(\w+)\.(\w+)/g;
    let t;
    while ((t = tokenRe.exec(args))) {
      const qualified = `${t[1]}.${t[2]}`;
      const id = consts.byQualified.get(qualified) ?? consts.byName.get(t[2]);
      if (id) ids.add(id);
    }
    const numRe = /\b(\d{4,8})\b/g;
    let n;
    while ((n = numRe.exec(args))) ids.add(Number(n[1]));
  }
  return ids;
}

export function listYdkFiles() {
  const dir = join(pkgRoot, "ydk");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ydk"))
    .map((f) => join(dir, f));
}

export function enginesDir() {
  return join(pkgRoot, "src", "Engines");
}

export function allBoundIds() {
  const consts = parseEngineConsts(enginesDir());
  const bound = new Set();
  for (const name of readdirSync(enginesDir()).filter((f) => f.endsWith(".cs"))) {
    const text = readFileSync(join(enginesDir(), name), "utf8");
    for (const id of parseBinds(text, consts)) bound.add(id);
  }
  return { bound, consts };
}
