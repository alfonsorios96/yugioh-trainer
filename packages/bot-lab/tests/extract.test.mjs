import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  extractLine,
  guessBotActor,
  goingOf,
  matchEndBoard,
  parseComboBook,
  classifySituation,
  diagnoseLine,
} from "../dist/index.js";

function board(partial = {}) {
  return {
    turn: 1,
    phase: "Main Phase 1",
    lpYou: 8000,
    lpOpp: 8000,
    youHand: [],
    oppHand: [],
    youMonsters: [],
    oppMonsters: [],
    youSpells: [],
    oppSpells: [],
    youGrave: [],
    oppGrave: [],
    ...partial,
  };
}

function step(partial) {
  return {
    id: 0,
    turn: 1,
    phase: "Main Phase 1",
    actor: "opp",
    kind: "activate",
    decision: false,
    chosen: "",
    cardCodes: [],
    board: board(),
    ...partial,
  };
}

function walk(steps, names = {}) {
  return {
    fileName: "fixture.yrpX",
    youName: names.youName ?? "Player",
    oppName: names.oppName ?? "Toon 2026",
    winner: "unknown",
    steps,
    cardCodes: [],
  };
}

const BOOKMARK = 91500017;
const WORLD = 7293697;
const RABBIT = 45536531;
const ULTIMATE = 71808988;
const TERROR = 53094821;
const ASH = 14558127;
const TABLE = 89997728;

describe("extractLine", () => {
  test("guesses the Toon bot as opp", () => {
    const w = walk([]);
    assert.equal(guessBotActor(w), "opp");
  });

  test("going first when bot takes turn 1", () => {
    const w = walk([
      step({ kind: "phase", turn: 1, actor: "opp", chosen: "Turno 1" }),
    ]);
    assert.equal(goingOf(w, "opp"), "first");
  });

  test("pulls opening hand, actions, endBoard and Ash threat", () => {
    const w = walk([
      step({
        kind: "draw",
        turn: 0,
        actor: "opp",
        cardCodes: [BOOKMARK, WORLD, TERROR],
      }),
      step({ kind: "phase", turn: 1, actor: "opp" }),
      step({
        kind: "activate",
        actor: "opp",
        cardCodes: [BOOKMARK],
        board: board({ oppSpells: [] }),
      }),
      step({
        kind: "activate",
        actor: "you",
        cardCodes: [ASH],
      }),
      step({
        kind: "activate",
        actor: "opp",
        cardCodes: [TABLE],
        board: board({
          oppSpells: [{ code: WORLD }],
        }),
      }),
    ]);
    const line = extractLine(w, "opp", { fromTurn: 1, toTurn: 1 });
    assert.deepEqual(line.openingHand, [BOOKMARK, WORLD, TERROR]);
    assert.equal(line.going, "first");
    assert.deepEqual(line.threats, ["ash"]);
    assert.equal(line.steps[0].cardId, BOOKMARK);
    assert.equal(line.steps[1].cardId, TABLE);
    assert.ok(line.worldOnField);
    assert.deepEqual(line.endBoard.spells, [WORLD]);
  });
});

describe("matchEndBoard", () => {
  test("accepts extra cards if expected are present", () => {
    const r = matchEndBoard(
      { monsters: [ULTIMATE], spells: [WORLD], grave: [] },
      { monsters: [ULTIMATE, RABBIT], spells: [WORLD, TERROR], grave: [BOOKMARK] },
    );
    assert.equal(r.ok, true);
  });

  test("reports missing passcodes", () => {
    const r = matchEndBoard(
      { monsters: [ULTIMATE], spells: [WORLD], grave: [] },
      { monsters: [], spells: [WORLD], grave: [] },
    );
    assert.deepEqual(r.missing, [ULTIMATE]);
  });
});

describe("classify + diagnose", () => {
  const book = parseComboBook({
    deckId: "toon-2026",
    engineFile: "src/Engines/ToonEngine.cs",
    situations: [
      {
        situationId: "going-first-full",
        title: "full",
        notes: "",
        when: { going: "first" },
        examples: [],
        steps: [{ kind: "activate", cardId: BOOKMARK, selectCard: [WORLD] }],
        endBoard: { monsters: [ULTIMATE], spells: [WORLD], grave: [] },
      },
      {
        situationId: "ash-on-search",
        title: "ash",
        notes: "",
        when: { going: "first", threats: ["ash"] },
        examples: [],
        steps: [{ kind: "activate", cardId: BOOKMARK }],
        endBoard: { monsters: [], spells: [WORLD], grave: [] },
      },
    ],
  });

  test("Ash line classifies as ash-on-search", () => {
    const w = walk([
      step({ kind: "draw", turn: 0, actor: "opp", cardCodes: [BOOKMARK] }),
      step({ kind: "phase", turn: 1, actor: "opp" }),
      step({ kind: "activate", actor: "opp", cardCodes: [BOOKMARK] }),
      step({ kind: "activate", actor: "you", cardCodes: [ASH] }),
    ]);
    const line = extractLine(w, "opp");
    const sit = classifySituation(book, line);
    assert.equal(sit?.situationId, "ash-on-search");
  });

  test("full combo endBoard is ok", () => {
    const line = {
      actor: "opp",
      going: "first",
      openingHand: [BOOKMARK],
      steps: [
        { kind: "activate", cardId: BOOKMARK },
        { kind: "spsummon", cardId: ULTIMATE },
      ],
      endBoard: { monsters: [ULTIMATE], spells: [WORLD, TERROR], grave: [] },
      threats: [],
      worldOnField: true,
      fromTurn: 1,
      toTurn: 1,
    };
    const d = diagnoseLine(book, line);
    assert.equal(d.verdict, "ok");
  });
});
