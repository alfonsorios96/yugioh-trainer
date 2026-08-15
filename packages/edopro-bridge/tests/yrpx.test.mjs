import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseYrpxWalkthrough, orientWalkthroughToHuman } from "../dist/yrpx.js";

const RABBIT = 45536531;
const TERROR = 53094821;

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

function u32le(n) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n >>> 0);
  return buf;
}

function summoning(code, ctrl = 0) {
  const payload = Buffer.alloc(14);
  payload.writeUInt32LE(code >>> 0, 0);
  payload[4] = ctrl;
  payload[5] = 0x04;
  return packet(60, payload);
}

function setFromHand(code, seq = 3) {
  const payload = Buffer.alloc(28);
  payload.writeUInt32LE(code >>> 0, 0);
  payload[4] = 0;
  payload[5] = 0x02;
  payload[14] = 0;
  payload[15] = 0x08;
  payload.writeUInt32LE(seq, 16);
  payload.writeUInt32LE(0x0a, 20);
  return packet(50, payload);
}

function turnStart(ctrl = 0) {
  return packet(40, Buffer.from([ctrl]));
}

describe("parseYrpxWalkthrough header layouts", () => {
  test("parses SINGLE_MODE / old 1v1 names without a player count", () => {
    const body = Buffer.concat([
      utf16Name("Player"),
      utf16Name(""),
      Buffer.alloc(8),
      turnStart(0),
      summoning(RABBIT),
      setFromHand(TERROR, 3),
    ]);
    const walk = parseYrpxWalkthrough(body, "demo.yrpX");
    assert.equal(walk.youName, "Player");
    assert.equal(walk.steps.filter((s) => s.kind === "summon").length, 1);
    assert.equal(walk.steps.find((s) => s.kind === "summon")?.cardCodes[0], RABBIT);
    const set = walk.steps.find((s) => s.kind === "set");
    assert.equal(set?.cardCodes[0], TERROR);
    assert.equal(set?.seq, 3);
    assert.equal(set?.pos, 0x0a);
    assert.equal(walk.steps.find((s) => s.kind === "summon")?.seq, 0);
  });

  test("keeps face-up defense on special summon", () => {
    const BAGOOSKA = 90590303;
    const payload = Buffer.alloc(14);
    payload.writeUInt32LE(BAGOOSKA, 0);
    payload[4] = 0;
    payload[5] = 0x04;
    payload.writeUInt32LE(4, 6);
    payload.writeUInt32LE(0x4, 10);
    const body = Buffer.concat([
      utf16Name("Player"),
      utf16Name(""),
      Buffer.alloc(8),
      turnStart(0),
      packet(62, payload),
    ]);
    const walk = parseYrpxWalkthrough(body, "bagooska.yrpX");
    const ss = walk.steps.find((s) => s.kind === "spsummon");
    assert.equal(ss?.cardCodes[0], BAGOOSKA);
    assert.equal(ss?.seq, 4);
    assert.equal(ss?.pos, 0x4);
    assert.equal(ss?.board.youMonsters[4]?.code, BAGOOSKA);
    assert.equal(ss?.board.youMonsters[4]?.pos, 0x4);
  });

  test("still parses NEWREPLAY count-prefixed names", () => {
    const body = Buffer.concat([
      u32le(1),
      utf16Name("Jorgito"),
      u32le(1),
      utf16Name("Toon 2026"),
      Buffer.alloc(8),
      turnStart(0),
      summoning(RABBIT),
    ]);
    const walk = parseYrpxWalkthrough(body, "new.yrpX");
    assert.equal(walk.youName, "Jorgito");
    assert.equal(walk.oppName, "Toon 2026");
    assert.equal(walk.going, "first");
    assert.equal(walk.youCtrl, 0);
    assert.equal(walk.steps.find((s) => s.kind === "summon")?.cardCodes[0], RABBIT);
    assert.equal(walk.steps.find((s) => s.kind === "summon")?.decision, true);
  });

  test("treats the WindBot as the opponent when they went first", () => {
    const body = Buffer.concat([
      u32le(1),
      utf16Name("[AI] Toon 2026"),
      u32le(1),
      utf16Name("Player"),
      Buffer.alloc(8),
      turnStart(0),
      summoning(RABBIT, 0),
      turnStart(1),
      summoning(TERROR, 1),
    ]);
    const walk = parseYrpxWalkthrough(body, "second.yrpX");
    assert.equal(walk.youName, "Player");
    assert.equal(walk.oppName, "[AI] Toon 2026");
    assert.equal(walk.youCtrl, 1);
    assert.equal(walk.going, "second");
    const summons = walk.steps.filter((s) => s.kind === "summon");
    assert.equal(summons[0]?.actor, "opp");
    assert.equal(summons[0]?.decision, false);
    assert.equal(summons[0]?.cardCodes[0], RABBIT);
    assert.equal(summons[0]?.chosen.includes("rival"), true);
    assert.equal(summons[1]?.actor, "you");
    assert.equal(summons[1]?.decision, true);
    assert.equal(summons[1]?.cardCodes[0], TERROR);
    assert.equal(summons[1]?.board.youMonsters.some((c) => c.code === TERROR), true);
    assert.equal(summons[1]?.board.oppMonsters.some((c) => c.code === RABBIT), true);
  });

  test("uses bot name hints when the AI nickname has no [AI] prefix", () => {
    const body = Buffer.concat([
      u32le(1),
      utf16Name("Light and Dark"),
      u32le(1),
      utf16Name("Player"),
      Buffer.alloc(8),
      turnStart(0),
      summoning(RABBIT, 0),
    ]);
    const walk = parseYrpxWalkthrough(body, "hint.yrpX", {
      botNames: ["Light and Darkness"],
    });
    assert.equal(walk.youName, "Player");
    assert.equal(walk.oppName, "Light and Dark");
    assert.equal(walk.going, "second");
    assert.equal(walk.steps.find((s) => s.kind === "summon")?.actor, "opp");
  });

  test("flips a saved walkthrough that stored the bot as you", () => {
    const inverted = parseYrpxWalkthrough(
      Buffer.concat([
        u32le(1),
        utf16Name("[AI] Toon 2026"),
        u32le(1),
        utf16Name("Player"),
        Buffer.alloc(8),
        turnStart(0),
        summoning(RABBIT, 0),
      ]),
      "old.yrpX",
      { orient: false },
    );
    assert.equal(inverted.youName, "[AI] Toon 2026");
    assert.equal(inverted.steps.find((s) => s.kind === "summon")?.decision, true);
    const oriented = orientWalkthroughToHuman(inverted);
    assert.equal(oriented.youName, "Player");
    assert.equal(oriented.oppName, "[AI] Toon 2026");
    assert.equal(oriented.going, "second");
    const summon = oriented.steps.find((s) => s.kind === "summon");
    assert.equal(summon?.actor, "opp");
    assert.equal(summon?.decision, false);
    assert.equal(summon?.chosen.includes("rival"), true);
  });
});
