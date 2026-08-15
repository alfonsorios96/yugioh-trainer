import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Toon 2026 Agent artefacts", () => {
  test("YDK and ToonCardId are present", () => {
    const ydk = join(pkgRoot, "ydk/AI_Toon2026.ydk");
    const ids = join(pkgRoot, "src/Engines/ToonEngine.cs");
    assert.ok(existsSync(ydk), "missing AI_Toon2026.ydk");
    assert.ok(existsSync(ids), "missing ToonEngine.cs");
    const cs = readFileSync(ids, "utf8");
    assert.match(cs, /class ToonCardId/);
    assert.match(cs, /ComicCat = 72921536/);
    assert.doesNotMatch(cs, /static void Register\(/);
  });
});
