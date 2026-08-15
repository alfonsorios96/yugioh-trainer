import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createSituation,
  emptyBook,
  modelFromBook,
  ToonId,
} from "../dist/index.js";

describe("modelFromBook", () => {
  test("turns consecutive steps into enable edges", () => {
    const book = {
      ...emptyBook(),
      situations: createSituation(emptyBook(), { title: "Full" }).situations.map(
        (s) => ({
          ...s,
          steps: [
            { kind: "activate", cardId: ToonId.ToonBookmark, selectCard: [ToonId.PerfectWorld] },
            { kind: "activate", cardId: ToonId.PerfectWorld },
            { kind: "summon", cardId: ToonId.ComicCat },
          ],
          endBoard: {
            monsters: [ToonId.ComicCat],
            spells: [ToonId.PerfectWorld],
            grave: [],
          },
        }),
      ),
    };
    const model = modelFromBook(book);
    const ids = model.nodes.map((n) => n.id);
    assert.ok(ids.includes(`c-${ToonId.ToonBookmark}`));
    assert.ok(ids.includes(`c-${ToonId.PerfectWorld}`));
    assert.ok(ids.includes(`c-${ToonId.ComicCat}`));
    assert.ok(
      model.edges.some(
        (e) =>
          e.from === `c-${ToonId.ToonBookmark}` &&
          e.to === `c-${ToonId.PerfectWorld}` &&
          e.kind === "enables",
      ),
    );
  });

  test("adds a threat window from when.threats", () => {
    const book = {
      ...emptyBook(),
      situations: createSituation(emptyBook(), { title: "Ash" }).situations.map(
        (s) => ({
          ...s,
          when: { threats: ["ash"] },
          steps: [
            { kind: "activate", cardId: ToonId.ToonBookmark },
            { kind: "set", cardId: ToonId.ToonTerror },
          ],
          endBoard: { monsters: [], spells: [ToonId.ToonTerror], grave: [] },
        }),
      ),
    };
    const model = modelFromBook(book);
    assert.ok(model.nodes.some((n) => n.id === "t-ash"));
    assert.ok(
      model.edges.some((e) => e.to === "t-ash" && e.kind === "window"),
    );
    assert.ok(
      model.edges.some((e) => e.from === "t-ash" && e.kind === "recovers"),
    );
  });
});
