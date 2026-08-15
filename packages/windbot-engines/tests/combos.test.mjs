import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { pkgRoot } from "./lib/parse.mjs";
const book = JSON.parse(
  readFileSync(join(pkgRoot, "combos/toon-2026/book.json"), "utf8"),
);
const model = JSON.parse(
  readFileSync(join(pkgRoot, "combos/toon-2026/model.json"), "utf8"),
);

describe("Toon 2026 combo book", () => {
  test("has the first-going seed situations", () => {
    const ids = new Set(book.situations.map((s) => s.situationId));
    for (const need of [
      "first-going-funny-dark-rabbit-no-extenders",
      "first-going-comic-cat-no-extenders",
      "first-going-comic-cat-no-extenders-alternative",
    ]) {
      assert.ok(ids.has(need), `missing situation ${need}`);
    }
  });

  test("Comic Cat line is the default over Alternative", () => {
    const main = book.situations.find(
      (s) => s.situationId === "first-going-comic-cat-no-extenders",
    );
    const alt = book.situations.find(
      (s) => s.situationId === "first-going-comic-cat-no-extenders-alternative",
    );
    assert.ok(main);
    assert.ok(alt);
    assert.ok((alt.priority ?? 0) < (main.priority ?? 0));
    assert.ok(main.when.handContains?.includes(72921536));
    assert.ok(main.when.handExcludes?.includes(45536531));
  });

  test("combo model has situation-derived edges", () => {
    assert.ok(model.edges.length > 0);
    assert.ok(model.edges.some((e) => e.kind === "enables"));
  });
});
