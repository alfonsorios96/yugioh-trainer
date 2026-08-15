import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applyPlacesToBoard, placeLabel, stanceFromPos, ToonId } from "../dist/index.js";

describe("placeLabel", () => {
  test("maps monster and extra zones", () => {
    assert.equal(placeLabel(0x04, 0), "MZ1");
    assert.equal(placeLabel(0x04, 4), "MZ5");
    assert.equal(placeLabel(0x04, 5), "EMZ");
    assert.equal(placeLabel(0x04, 6), "EMZ2");
  });

  test("maps spell and field zones", () => {
    assert.equal(placeLabel(0x08, 2), "ST3");
    assert.equal(placeLabel(0x08, 5), "Campo");
  });

  test("ignores hand and deck", () => {
    assert.equal(placeLabel(0x02, 0), undefined);
  });
});

describe("stanceFromPos", () => {
  test("maps YGOPro position flags", () => {
    assert.equal(stanceFromPos(0x1), "atk");
    assert.equal(stanceFromPos(0x4), "def");
    assert.equal(stanceFromPos(0x5), "atk");
    assert.equal(stanceFromPos(0x8), "set");
    assert.equal(stanceFromPos(0x0a), "set");
    assert.equal(stanceFromPos(0x0a, "set"), "set");
    assert.equal(stanceFromPos(undefined, "set"), "set");
  });
});

describe("applyPlacesToBoard", () => {
  test("keeps stored monsterZones", () => {
    const board = applyPlacesToBoard({
      monsters: [ToonId.CharmerQuartet],
      spells: [],
      grave: [],
      banished: [],
      monsterZones: [ToonId.CharmerQuartet, 0, 0, ToonId.EvilBox, ToonId.ComicCat, ToonId.PerfectronHydradrive, 0],
      spellZones: [0, 0, ToonId.MindScan, ToonId.ToonTerror, 0, ToonId.PerfectWorld],
    });
    assert.equal(board.monsterZones[0], ToonId.CharmerQuartet);
    assert.equal(board.monsterZones[3], ToonId.EvilBox);
    assert.equal(board.monsterZones[5], ToonId.PerfectronHydradrive);
    assert.equal(board.spellZones[5], ToonId.PerfectWorld);
  });

  test("fills slots from the last step place when zones are missing", () => {
    const board = applyPlacesToBoard(
      {
        monsters: [ToonId.CharmerQuartet, ToonId.ComicCat],
        spells: [ToonId.MindScan],
        grave: [],
        banished: [],
      },
      [
        { kind: "spsummon", cardId: ToonId.CharmerQuartet, place: "MZ1" },
        { kind: "spsummon", cardId: ToonId.ComicCat, place: "MZ5" },
        { kind: "activate", cardId: ToonId.MindScan, place: "ST3" },
      ],
    );
    assert.equal(board.monsterZones[0], ToonId.CharmerQuartet);
    assert.equal(board.monsterZones[4], ToonId.ComicCat);
    assert.equal(board.spellZones[2], ToonId.MindScan);
  });

  test("marks set traps and defense monsters", () => {
    const board = applyPlacesToBoard(
      {
        monsters: [ToonId.Bagooska],
        spells: [ToonId.ToonTerror],
        grave: [],
        banished: [],
        monsterZones: [0, 0, 0, 0, ToonId.Bagooska, 0, 0],
        spellZones: [0, 0, 0, ToonId.ToonTerror, 0, 0],
      },
      [
        { kind: "spsummon", cardId: ToonId.Bagooska, place: "MZ5", stance: "def" },
        { kind: "set", cardId: ToonId.ToonTerror, place: "ST4" },
      ],
    );
    assert.equal(board.monsterStances[4], "def");
    assert.equal(board.spellStances[3], "set");
  });
});
