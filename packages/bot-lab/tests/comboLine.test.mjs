import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ToonId, buildComboLine } from "../dist/index.js";

describe("buildComboLine", () => {
  test("collapses summon + activate of the same card", () => {
    const beats = buildComboLine([
      { kind: "summon", cardId: ToonId.FunnyDarkRabbit },
      { kind: "activate", cardId: ToonId.FunnyDarkRabbit },
      { kind: "activate", cardId: ToonId.PerfectWorld },
    ]);
    assert.deepEqual(
      beats.map((b) => `${b.verb} ${b.code}`),
      [
        `invoca ${ToonId.FunnyDarkRabbit}`,
        `activa ${ToonId.PerfectWorld}`,
      ],
    );
  });

  test("Faceless into Mind Scan is coloca", () => {
    const beats = buildComboLine([
      { kind: "activate", cardId: ToonId.FacelessMage },
      { kind: "activate", cardId: ToonId.MindScan },
    ]);
    assert.equal(beats[1].verb, "coloca");
    assert.equal(beats[1].code, ToonId.MindScan);
  });

  test("Comic Cat into a toon is sacrifica", () => {
    const beats = buildComboLine([
      { kind: "summon", cardId: ToonId.ComicCat },
      { kind: "activate", cardId: ToonId.ComicCat },
      { kind: "spsummon", cardId: ToonId.BlueEyesToonDragon },
    ]);
    assert.equal(beats[0].verb, "invoca");
    assert.equal(beats[1].verb, "sacrifica");
    assert.equal(beats[1].code, ToonId.BlueEyesToonDragon);
  });

  test("shows selectCard extras that are not the next step", () => {
    const beats = buildComboLine([
      {
        kind: "activate",
        cardId: ToonId.ToonBookmark,
        selectCard: [ToonId.PerfectWorld, ToonId.ToonTerror],
      },
      { kind: "activate", cardId: ToonId.PerfectWorld },
    ]);
    assert.equal(beats[0].verb, "busca");
    assert.equal(beats[1].code, ToonId.ToonTerror);
    assert.equal(beats[1].verb, "busca");
    assert.equal(beats[2].code, ToonId.PerfectWorld);
  });

  test("same card coming back is recicla", () => {
    const beats = buildComboLine([
      { kind: "spsummon", cardId: ToonId.EvilBox },
      { kind: "spsummon", cardId: ToonId.EvilBox },
    ]);
    assert.equal(beats[1].verb, "recicla");
  });

  test("keeps summon place after collapsing activate", () => {
    const beats = buildComboLine([
      { kind: "summon", cardId: ToonId.ComicCat, place: "MZ5" },
      { kind: "activate", cardId: ToonId.ComicCat },
      { kind: "spsummon", cardId: ToonId.BlueEyesToonDragon, place: "MZ2" },
    ]);
    assert.equal(beats[0].place, "MZ5");
    assert.equal(beats[1].place, "MZ2");
  });
});
