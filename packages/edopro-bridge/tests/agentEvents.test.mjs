import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { actionInTop5, isLegalActionId } from "../dist/agentEvents.js";

describe("agent event helpers", () => {
  const request = {
    requestId: "r1",
    duelId: "d",
    turn: 1,
    phase: "MP1",
    going: "first",
    self: { lp: 8000, hand: [45536531], monsters: [], spells: [] },
    opp: { lp: 8000, hand: [], monsters: [], spells: [] },
    legalActions: [
      { id: "ns-rabbit", kind: "summon", cardId: 45536531 },
      { id: "to-ep", kind: "to_ep" },
    ],
  };

  test("isLegalActionId", () => {
    assert.equal(isLegalActionId(request, "ns-rabbit"), true);
    assert.equal(isLegalActionId(request, "nope"), false);
  });

  test("actionInTop5", () => {
    const proposal = {
      requestId: "r1",
      top5: [{ actionId: "ns-rabbit", kind: "summon", score: 100, why: "x" }],
      othersCount: 1,
      situationId: null,
      mode: "follow",
      targetBoard: "",
      legalActions: request.legalActions,
      scores: { "ns-rabbit": 100 },
    };
    assert.equal(actionInTop5(proposal, "ns-rabbit"), true);
    assert.equal(actionInTop5(proposal, "to-ep"), false);
  });
});
