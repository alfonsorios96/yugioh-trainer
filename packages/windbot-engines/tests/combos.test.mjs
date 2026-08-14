import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  enginesDir,
  parseEngineConsts,
  parseSelectCardIds,
  pkgRoot,
} from "./lib/parse.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const book = JSON.parse(
  readFileSync(join(pkgRoot, "combos/toon-2026/book.json"), "utf8"),
);
const model = JSON.parse(
  readFileSync(join(pkgRoot, "combos/toon-2026/model.json"), "utf8"),
);

describe("Toon 2026 combo book", () => {
  const engineText = readFileSync(join(pkgRoot, book.engineFile), "utf8");
  const consts = parseEngineConsts(enginesDir());
  const selectIds = parseSelectCardIds(engineText, consts);

  test("has the seed situations", () => {
    const ids = new Set(book.situations.map((s) => s.situationId));
    for (const need of [
      "going-first-full",
      "going-first-table-only",
      "world-already-up",
      "ash-on-search",
      "going-second-tribute",
      "maxx-c",
      "no-rabbit",
    ]) {
      assert.ok(ids.has(need), `missing situation ${need}`);
    }
  });

  test("every situation selectCard/selectNextCard id is in ToonEngine", () => {
    const missing = [];
    for (const sit of book.situations) {
      for (const step of sit.steps) {
        for (const id of [...(step.selectCard ?? []), ...(step.selectNextCard ?? [])]) {
          if (!selectIds.has(id)) {
            missing.push(`${sit.situationId}:${step.cardId}->${id}`);
          }
        }
      }
    }
    assert.deepEqual(missing, [], `Unbound combo priorities: ${missing.join(", ")}`);
  });

  test("combo model has resilience edges", () => {
    assert.ok(model.edges.some((e) => e.kind === "recovers"));
    assert.ok(model.edges.some((e) => e.kind === "window"));
    assert.ok(model.edges.some((e) => e.kind === "requires"));
  });
});
