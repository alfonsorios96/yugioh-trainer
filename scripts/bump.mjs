#!/usr/bin/env node
/**
 * Sync semver across the monorepo (npm packages + Tauri + Cargo).
 *
 *   node scripts/bump.mjs                # infer from commits since last tag
 *   node scripts/bump.mjs patch          # explicit patch | minor | major
 *   node scripts/bump.mjs --commit --tag --push
 *
 * Conventional commits:
 *   BREAKING CHANGE / type!:  major
 *   feat:                     minor
 *   anything else:            patch
 * Skip: chore(release): …  or  [skip bump]
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUMP_TYPES = new Set(["major", "minor", "patch"]);
const args = process.argv.slice(2);
const flags = {
  commit: args.includes("--commit"),
  tag: args.includes("--tag"),
  push: args.includes("--push"),
  dryRun: args.includes("--dry-run"),
};
const explicit = args.find((a) => BUMP_TYPES.has(a));
const RELEASE_MSG = /^chore\(release\)/;
const SKIP_RE = /\[skip bump\]/i;
const BREAKING_RE = /BREAKING CHANGE:|^[a-z]+(\([^)]+\))?!:/m;
const FEAT_RE = /^feat(\([^)]+\))?:/m;

const VERSION_FILES = {
  json: [
    "package.json",
    "apps/trainer/package.json",
    "apps/trainer/src-tauri/tauri.conf.json",
    "packages/coach/package.json",
    "packages/edopro-bridge/package.json",
    "packages/windbot-engines/package.json",
  ],
  lockPackages: [
    "",
    "apps/trainer",
    "packages/coach",
    "packages/edopro-bridge",
    "packages/windbot-engines",
  ],
  cargoToml: "apps/trainer/src-tauri/Cargo.toml",
  cargoLock: "apps/trainer/src-tauri/Cargo.lock",
  packageLock: "package-lock.json",
};

function git(cmd, opts = {}) {
  return execSync(`git ${cmd}`, {
    cwd: root,
    encoding: "utf8",
    stdio: opts.stdio ?? ["ignore", "pipe", "pipe"],
  }).trim();
}

function lastTag() {
  try {
    return git("describe --tags --abbrev=0");
  } catch {
    return null;
  }
}

function commitMessagesSince(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  try {
    return git(`log ${range} --pretty=%B%x1e`)
      .split("\x1e")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function inferBump(messages) {
  let bump = "patch";
  for (const msg of messages) {
    if (BREAKING_RE.test(msg)) return "major";
    if (FEAT_RE.test(msg)) bump = "minor";
  }
  return bump;
}

function shouldSkip(messages) {
  if (messages.length === 0) return true;
  return messages.every((m) => RELEASE_MSG.test(m) || SKIP_RE.test(m));
}

function bumpSemver(version, type) {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid semver: ${version}`);
  }
  const [major, minor, patch] = parts;
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function abs(rel) {
  return join(root, rel);
}

function updateJsonVersion(rel, version) {
  const file = abs(rel);
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.version = version;
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}

function updatePackageLock(version) {
  const file = abs(VERSION_FILES.packageLock);
  if (!existsSync(file)) return;
  const lock = JSON.parse(readFileSync(file, "utf8"));
  lock.version = version;
  for (const key of VERSION_FILES.lockPackages) {
    if (lock.packages?.[key]) lock.packages[key].version = version;
  }
  writeFileSync(file, `${JSON.stringify(lock, null, 2)}\n`);
}

function updateCargoToml(version) {
  const file = abs(VERSION_FILES.cargoToml);
  const text = readFileSync(file, "utf8");
  const updated = text.replace(
    /^(\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m,
    `$1${version}$2`,
  );
  if (updated === text) throw new Error(`Could not update version in ${VERSION_FILES.cargoToml}`);
  writeFileSync(file, updated);
}

function updateCargoLock(version) {
  const file = abs(VERSION_FILES.cargoLock);
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  const updated = text.replace(
    /(\[\[package\]\]\nname = "trainer"\nversion = ")[^"]+(")/,
    `$1${version}$2`,
  );
  writeFileSync(file, updated);
}

function writeVersions(version) {
  for (const rel of VERSION_FILES.json) updateJsonVersion(rel, version);
  updatePackageLock(version);
  updateCargoToml(version);
  updateCargoLock(version);
}

function stagedFiles() {
  return [
    ...VERSION_FILES.json,
    VERSION_FILES.packageLock,
    VERSION_FILES.cargoToml,
    VERSION_FILES.cargoLock,
  ];
}

function main() {
  const pkg = JSON.parse(readFileSync(abs("package.json"), "utf8"));
  const current = pkg.version;
  const messages = commitMessagesSince(lastTag());

  if (!explicit && shouldSkip(messages)) {
    console.log("bump: skip (release commit, [skip bump], or no new commits)");
    return;
  }

  try {
    if (git("describe --exact-match HEAD")) {
      if (!explicit) {
        console.log("bump: skip (HEAD is already tagged)");
        return;
      }
    }
  } catch {
    // HEAD is not tagged — continue
  }

  const type = explicit ?? inferBump(messages);
  const next = bumpSemver(current, type);

  console.log(`${current} → ${next} (${type})`);

  if (flags.dryRun) {
    console.log("bump: dry-run, files not written");
    return;
  }

  writeVersions(next);

  if (!flags.commit) return;

  const tag = `v${next}`;
  const message = `chore(release): ${tag}`;
  execSync(`git add ${stagedFiles().join(" ")}`, { cwd: root, stdio: "inherit" });
  execSync(`git commit -m "${message}"`, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, HUSKY: "0" },
  });

  if (flags.tag) {
    execSync(`git tag ${tag}`, { cwd: root, stdio: "inherit" });
  }

  if (flags.push) {
    const extra = flags.tag ? " --follow-tags" : "";
    execSync(`git push origin HEAD${extra}`, { cwd: root, stdio: "inherit" });
  }
}

main();
