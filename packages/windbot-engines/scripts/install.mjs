#!/usr/bin/env node
/**
 * Copy META engine .ydk files, merge bots.json, and install Kewl Tune / LADR / Toon executors.
 *
 * Local EDOPro WindBot.exe does not export DefaultExecutor (types live in ExecutorBase
 * or were internalized). Plugin compile against the exe fails. This script:
 *   1. Tries a plugin DLL if ExecutorBase.dll sits next to WindBot.exe
 *   2. Otherwise clones ProjectIgnis/windbot, injects our C#, builds, and replaces the exe
 *
 * Usage: node scripts/install.mjs /path/to/ProjectIgnis
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const manifest = JSON.parse(readFileSync(join(pkgRoot, "manifest.json"), "utf8"));
const WINDBOT_REPO = "https://github.com/ProjectIgnis/windbot.git";
const cacheDir = join(pkgRoot, ".cache", "windbot");

function run(bin, args, opts = {}) {
  return spawnSync(bin, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...opts,
  });
}

function findWindBotExe(windBotDir) {
  for (const name of ["WindBot.exe", "windbot.exe", "WindBot"]) {
    const p = join(windBotDir, name);
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

function collectDllRefs(windBotDir) {
  const refs = [];
  const exe = findWindBotExe(windBotDir);
  if (exe) refs.push(exe);
  for (const name of ["ExecutorBase.dll", "Mono.Data.Sqlite.dll"]) {
    const p = join(windBotDir, name);
    if (existsSync(p)) refs.push(p);
  }
  return refs;
}

function compilePlugin(windBotDir, outDll) {
  const refs = collectDllRefs(windBotDir);
  if (refs.length === 0) {
    return { ok: false, message: "No WindBot.exe / ExecutorBase.dll to reference." };
  }
  const sources = manifest.sourceFiles.map((rel) => join(pkgRoot, rel));
  const refArgsMcs = refs.map((r) => `-r:${r}`);
  const refArgsCsc = refs.map((r) => `-reference:${r}`);
  const compilers = [
    ["mcs", ["-sdk:4", "-target:library", ...refArgsMcs, `-out:${outDll}`, ...sources]],
    ["csc", ["-nologo", "-target:library", ...refArgsCsc, `-out:${outDll}`, ...sources]],
  ];
  const errors = [];
  for (const [bin, args] of compilers) {
    const result = run(bin, args);
    if (result.error && result.error.code === "ENOENT") {
      errors.push(`${bin} not on PATH`);
      continue;
    }
    if (result.status === 0 && existsSync(outDll)) {
      return { ok: true, mode: "plugin", message: `Compiled plugin DLL with ${bin}` };
    }
    errors.push(`${bin}: ${(result.stderr || result.stdout || "failed").trim()}`);
  }
  return { ok: false, message: errors.join(" | ") };
}

function ensureWindBotClone() {
  if (existsSync(join(cacheDir, "WindBot.csproj"))) {
    return { ok: true, message: `Using cached ${cacheDir}` };
  }
  mkdirSync(dirname(cacheDir), { recursive: true });
  const result = run("git", [
    "clone",
    "--depth",
    "1",
    "--recurse-submodules",
    WINDBOT_REPO,
    cacheDir,
  ]);
  if (result.status !== 0) {
    return {
      ok: false,
      message: `git clone failed: ${(result.stderr || result.stdout || "").trim()}`,
    };
  }
  return { ok: true, message: `Cloned ProjectIgnis/windbot into ${cacheDir}` };
}

function injectSources() {
  const destDir = join(cacheDir, "Game", "AI", "Decks");
  mkdirSync(destDir, { recursive: true });
  const copied = [];
  for (const rel of manifest.sourceFiles) {
    const dest = join(destDir, rel.split("/").pop());
    copyFileSync(join(pkgRoot, rel), dest);
    copied.push(dest);
  }
  patchCsproj(join(cacheDir, "WindBot.csproj"), copied.map((p) => p.slice(cacheDir.length + 1)));
  return copied;
}

function patchCsproj(csprojPath, relativeCsFiles) {
  if (!existsSync(csprojPath)) return;
  let xml = readFileSync(csprojPath, "utf8");
  const toAdd = [];
  for (const rel of relativeCsFiles) {
    const unix = rel.replace(/\\/g, "/");
    const win = unix.replace(/\//g, "\\");
    if (xml.includes(unix) || xml.includes(win) || xml.includes(unix.split("/").pop())) continue;
    toAdd.push(win);
  }
  if (toAdd.length === 0) return;
  const block = [
    "  <ItemGroup>",
    ...toAdd.map((inc) => `    <Compile Include="${inc}" />`),
    "  </ItemGroup>",
    "</Project>",
  ].join("\n");
  if (/<\/Project>\s*$/.test(xml)) {
    xml = xml.replace(/<\/Project>\s*$/, `${block}\n`);
  } else {
    xml += `\n${block}\n`;
  }
  writeFileSync(csprojPath, xml);
}

function findBuiltExe(root) {
  const hints = [
    join(root, "bin", "Release", "WindBot.exe"),
    join(root, "bin", "x86", "Release", "WindBot.exe"),
    join(root, "bin", "Release", "WindBot", "WindBot.exe"),
    join(root, "out", "WindBot", "bin", "Release", "WindBot.exe"),
    join(root, "out", "WindBot", "bin", "WindBot.exe"),
  ];
  for (const p of hints) {
    if (existsSync(p)) return p;
  }
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name === ".git" || name === "obj" || name === "Decks") continue;
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (dir.split("/").length - root.split("/").length < 6) stack.push(p);
      } else if (name === "WindBot.exe" && !p.includes("/obj/")) {
        return p;
      }
    }
  }
  return null;
}

function restoreAndBuild() {
  const sln = join(cacheDir, "WindBot.sln");
  const csproj = join(cacheDir, "WindBot.csproj");
  const target = existsSync(csproj) ? csproj : sln;
  const extra = ["/p:Configuration=Release", "/p:Posix=true"];
  const attempts = [
    ["msbuild", [target, "-t:restore", ...extra]],
    ["nuget", ["restore", sln]],
    ["dotnet", ["restore", sln]],
  ];
  for (const [bin, args] of attempts) {
    const result = run(bin, args, { cwd: cacheDir });
    if (result.error && result.error.code === "ENOENT") continue;
    if (result.status === 0) break;
  }
  const builders = [
    ["msbuild", [target, ...extra]],
    ["xbuild", [target, ...extra]],
    ["dotnet", ["msbuild", target, "-p:Configuration=Release", "-p:Posix=true"]],
  ];
  const errors = [];
  for (const [bin, args] of builders) {
    const result = run(bin, args, { cwd: cacheDir });
    if (result.error && result.error.code === "ENOENT") {
      errors.push(`${bin} not on PATH`);
      continue;
    }
    const built = findBuiltExe(cacheDir);
    if (result.status === 0 && built) {
      return { ok: true, exe: built, message: `Built WindBot.exe with ${bin}` };
    }
    errors.push(`${bin}: ${(result.stderr || result.stdout || "failed").trim().slice(-2000)}`);
  }
  return { ok: false, message: errors.join(" | ") };
}

function installBuiltExe(windBotDir, builtExe) {
  const destExe = join(windBotDir, "WindBot.exe");
  const bak = join(windBotDir, "WindBot.exe.ygo-trainer-bak");
  if (existsSync(destExe) && !existsSync(bak)) {
    copyFileSync(destExe, bak);
  }
  copyFileSync(builtExe, destExe);
  const builtDir = dirname(builtExe);
  const copied = ["WindBot.exe"];
  try {
    for (const name of readdirSync(builtDir)) {
      if (!name.toLowerCase().endsWith(".dll")) continue;
      if (name.toLowerCase().startsWith("mscorlib")) continue;
      if (name.toLowerCase().startsWith("libwindbot")) continue;
      if (name.toLowerCase() === "sqlite3.dll") continue;
      copyFileSync(join(builtDir, name), join(windBotDir, name));
      copied.push(name);
    }
  } catch {
    // ignore
  }
  return copied;
}

function rebuildIntoInstall(windBotDir) {
  const cloned = ensureWindBotClone();
  if (!cloned.ok) return cloned;
  injectSources();
  const built = restoreAndBuild();
  if (!built.ok) {
    return {
      ok: false,
      message: `${cloned.message}. Rebuild failed: ${built.message}`,
    };
  }
  const copied = installBuiltExe(windBotDir, built.exe);
  return {
    ok: true,
    mode: "rebuilt-exe",
    message: `${cloned.message}. ${built.message}. Installed ${copied.join(", ")} (original exe backed up as WindBot.exe.ygo-trainer-bak).`,
  };
}

function mergeBotsJson(windBotDir) {
  const botsPath = join(windBotDir, "bots.json");
  if (!existsSync(botsPath)) {
    console.warn("bots.json not found — skip merge");
    return;
  }
  const bots = JSON.parse(readFileSync(botsPath, "utf8"));
  if (!Array.isArray(bots)) {
    console.warn("bots.json is not an array — skip merge");
    return;
  }
  for (const deck of manifest.decks) {
    const entry = {
      name: deck.name,
      deck: deck.deck,
      difficulty: deck.difficulty,
      masterRules: deck.masterRules,
    };
    const idx = bots.findIndex((b) => b && b.name === entry.name);
    if (idx === -1) {
      bots.push(entry);
      console.log(`bots.json: added ${entry.name}`);
    } else {
      bots[idx] = { ...bots[idx], ...entry };
      console.log(`bots.json: updated ${entry.name}`);
    }
  }
  writeFileSync(botsPath, `${JSON.stringify(bots, null, 4)}\n`);
}

function main() {
  const root = process.argv[2];
  if (!root) {
    console.error("Usage: node scripts/install.mjs /path/to/ProjectIgnis");
    process.exit(1);
  }
  const edo = resolve(root);
  const windBot = join(edo, "WindBot");
  const decksDir = join(windBot, "Decks");
  const executorsDir = join(windBot, "Executors");
  const sourcesDir = join(windBot, "EngineSources");
  if (!existsSync(windBot)) {
    console.error(`No WindBot folder at ${windBot}`);
    process.exit(1);
  }
  mkdirSync(decksDir, { recursive: true });
  mkdirSync(executorsDir, { recursive: true });
  mkdirSync(sourcesDir, { recursive: true });

  const ydkDir = join(pkgRoot, "ydk");
  for (const file of readdirSync(ydkDir).filter((f) => f.endsWith(".ydk"))) {
    copyFileSync(join(ydkDir, file), join(decksDir, file));
    console.log(`Copied ${file}`);
  }
  for (const rel of manifest.sourceFiles) {
    const dest = join(sourcesDir, rel.replace(/^src\//, ""));
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(pkgRoot, rel), dest);
  }

  mergeBotsJson(windBot);

  const dllPath = join(executorsDir, manifest.dll);
  const hasExecutorBase = existsSync(join(windBot, "ExecutorBase.dll"));
  let compiled = hasExecutorBase
    ? compilePlugin(windBot, dllPath)
    : { ok: false, message: "No ExecutorBase.dll — plugin path skipped." };
  if (!compiled.ok) {
    console.log(compiled.message);
    console.log("Rebuilding WindBot from ProjectIgnis/windbot with META engines injected…");
    compiled = rebuildIntoInstall(windBot);
  }
  console.log(compiled.message);

  const marker = {
    installedAt: new Date().toISOString(),
    decks: manifest.decks.map((d) => d.deck),
    dll: compiled.ok && compiled.mode === "plugin" ? manifest.dll : null,
    compile: compiled.ok ? "ok" : "skipped",
    compileNote: compiled.message,
    mode: compiled.mode || null,
  };
  writeFileSync(join(executorsDir, manifest.marker), `${JSON.stringify(marker, null, 2)}\n`);
  if (!compiled.ok) {
    console.warn("YDKs installed, but WindBot executors did not compile.");
    console.warn("Need git + msbuild/xbuild (Mono) to rebuild WindBot.exe from ProjectIgnis/windbot.");
    process.exit(2);
  }
}

main();
