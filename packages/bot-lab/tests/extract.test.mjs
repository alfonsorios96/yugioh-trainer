import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  extractComboLine,
  extractLine,
  guessBotActor,
  goingOf,
  matchEndBoard,
  parseComboBook,
  classifySituation,
  diagnoseLine,
  boardForActor,
  ToonId,
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
    youBanished: [],
    oppBanished: [],
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
const FIREWALL = 5043010;

describe("extractLine", () => {
  test("guesses the Toon bot as opp", () => {
    const w = walk([]);
    assert.equal(guessBotActor(w), "opp");
  });

  test("guesses a human Toon player as you by the cards they played", () => {
    const w = walk(
      [
        step({ kind: "phase", turn: 1, actor: "you" }),
        step({
          kind: "activate",
          turn: 1,
          actor: "you",
          cardCodes: [BOOKMARK],
        }),
      ],
      { youName: "Jorgito", oppName: "Player" },
    );
    assert.equal(guessBotActor(w), "you");
    const line = extractComboLine(w);
    assert.equal(line.actor, "you");
    assert.equal(line.fromTurn, 1);
    assert.equal(line.steps[0].cardId, BOOKMARK);
  });

  test("extracts going-second combo on turn 2", () => {
    const w = walk(
      [
        step({ kind: "phase", turn: 1, actor: "opp" }),
        step({ kind: "phase", turn: 2, actor: "you" }),
        step({
          kind: "activate",
          turn: 2,
          actor: "you",
          cardCodes: [BOOKMARK],
        }),
      ],
      { youName: "Jorgito", oppName: "Player" },
    );
    const line = extractComboLine(w);
    assert.equal(line.fromTurn, 2);
    assert.equal(line.going, "second");
    assert.equal(line.steps[0].cardId, BOOKMARK);
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

  test("keeps monster and spell zone slots", () => {
    const CHARMER = 27519978;
    const BOX = 8915275;
    const CAT = 72921536;
    const PERF = 13203964;
    const SCAN = 34298391;
    const end = boardForActor(
      board({
        youMonsters: [
          { code: CHARMER },
          { code: 0 },
          { code: 0 },
          { code: BOX },
          { code: CAT, pos: 0x4 },
          { code: PERF },
          { code: 0 },
        ],
        youSpells: [
          { code: 0 },
          { code: 0 },
          { code: SCAN },
          { code: TERROR, pos: 0x0a },
          { code: 0 },
          { code: WORLD },
        ],
      }),
      "you",
    );
    assert.deepEqual(end.monsterZones, [CHARMER, 0, 0, BOX, CAT, PERF, 0]);
    assert.deepEqual(end.spellZones, [0, 0, SCAN, TERROR, 0, WORLD]);
    assert.deepEqual(end.monsters, [CHARMER, BOX, CAT, PERF]);
    assert.equal(end.spellStances[3], "set");
    assert.equal(end.monsterStances[4], "def");
  });
});

describe("yrpX single-mode extraction", () => {
  test("extracts summon/set after a header without player counts", async () => {
    const { parseYrpxWalkthrough } = await import("@yugioh/edopro-bridge");
    function utf16Name(text) {
      const buf = Buffer.alloc(40);
      for (let i = 0; i < text.length && i < 20; i++) {
        buf.writeUInt16LE(text.charCodeAt(i), i * 2);
      }
      return buf;
    }
    function packet(msg, payload) {
      const buf = Buffer.alloc(5 + payload.length);
      buf[0] = msg;
      buf.writeUInt32LE(payload.length, 1);
      payload.copy(buf, 5);
      return buf;
    }
    const summonPayload = Buffer.alloc(14);
    summonPayload.writeUInt32LE(RABBIT, 0);
    summonPayload[5] = 0x04;
    summonPayload.writeUInt32LE(2, 6);
    summonPayload.writeUInt32LE(0x1, 10);
    const body = Buffer.concat([
      utf16Name("Player"),
      utf16Name(""),
      Buffer.alloc(8),
      packet(40, Buffer.from([0])),
      packet(60, summonPayload),
    ]);
    const line = extractComboLine(parseYrpxWalkthrough(body, "demo.yrpX"));
    assert.equal(line.actor, "you");
    assert.equal(line.going, "first");
    assert.equal(line.steps[0].cardId, RABBIT);
    assert.equal(line.steps[0].place, "MZ3");
    assert.equal(line.steps[0].stance, undefined);
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

  test("requires expected banished cards", () => {
    const r = matchEndBoard(
      { monsters: [], spells: [], grave: [], banished: [FIREWALL] },
      { monsters: [], spells: [], grave: [], banished: [] },
    );
    assert.deepEqual(r.missing, [FIREWALL]);
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
