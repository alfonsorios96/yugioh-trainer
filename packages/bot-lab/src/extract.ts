import type {
  Actor,
  BoardSnapshot,
  ReplayStep,
  ReplayWalkthrough,
} from "@yugioh/edopro-bridge";
import { BOT_NAME_HINTS, InterruptId, isWorldCard } from "./cards.js";
import type {
  ComboStep,
  ComboStepKind,
  EndBoard,
  Going,
} from "./types.js";

const ACTION_KINDS = new Set<ComboStepKind>([
  "activate",
  "summon",
  "spsummon",
  "set",
]);

const INTERRUPT_LABEL: Record<number, string> = {
  [InterruptId.Ash]: "ash",
  [InterruptId.MaxxC]: "maxx-c",
  [InterruptId.Imperm]: "imperm",
  [InterruptId.Nibiru]: "nibiru",
  [InterruptId.Veiler]: "veiler",
  [InterruptId.GhostOgre]: "ghost-ogre",
};

export interface ExtractedLine {
  actor: Actor;
  going: Going;
  openingHand: number[];
  steps: ComboStep[];
  endBoard: EndBoard;
  threats: string[];
  worldOnField: boolean;
  fromTurn: number;
  toTurn: number;
}

export function guessBotActor(walk: ReplayWalkthrough): Actor {
  const you = walk.youName.toLowerCase();
  const opp = walk.oppName.toLowerCase();
  if (BOT_NAME_HINTS.some((h) => opp.includes(h))) return "opp";
  if (BOT_NAME_HINTS.some((h) => you.includes(h))) return "you";
  return "opp";
}

export function goingOf(walk: ReplayWalkthrough, actor: Actor): Going {
  const firstTurn = walk.steps.find((s) => s.kind === "phase" && s.turn === 1);
  if (!firstTurn) return "first";
  return firstTurn.actor === actor ? "first" : "second";
}

export function extractOpeningHand(
  walk: ReplayWalkthrough,
  actor: Actor,
): number[] {
  const draw = walk.steps.find((s) => s.actor === actor && s.kind === "draw");
  return draw?.cardCodes.filter((id) => id > 0) ?? [];
}

export function boardForActor(board: BoardSnapshot, actor: Actor): EndBoard {
  if (actor === "you") {
    return {
      monsters: board.youMonsters.map((c) => c.code).filter((id) => id > 0),
      spells: board.youSpells.map((c) => c.code).filter((id) => id > 0),
      grave: board.youGrave.map((c) => c.code).filter((id) => id > 0),
    };
  }
  return {
    monsters: board.oppMonsters.map((c) => c.code).filter((id) => id > 0),
    spells: board.oppSpells.map((c) => c.code).filter((id) => id > 0),
    grave: board.oppGrave.map((c) => c.code).filter((id) => id > 0),
  };
}

export function detectThreats(
  walk: ReplayWalkthrough,
  actor: Actor,
  fromTurn = 1,
  toTurn = 1,
): string[] {
  const rival: Actor = actor === "you" ? "opp" : "you";
  const seen = new Set<string>();
  for (const step of walk.steps) {
    if (step.turn < fromTurn || step.turn > toTurn) continue;
    if (step.actor !== rival || step.kind !== "activate") continue;
    for (const code of step.cardCodes) {
      const label = INTERRUPT_LABEL[code];
      if (label) seen.add(label);
    }
  }
  return [...seen];
}

function isActionStep(step: ReplayStep): step is ReplayStep & { kind: ComboStepKind } {
  return ACTION_KINDS.has(step.kind as ComboStepKind);
}

export function extractLine(
  walk: ReplayWalkthrough,
  actor: Actor,
  opts: { fromTurn?: number; toTurn?: number } = {},
): ExtractedLine {
  const fromTurn = opts.fromTurn ?? 1;
  const toTurn = opts.toTurn ?? fromTurn;
  const going = goingOf(walk, actor);
  const openingHand = extractOpeningHand(walk, actor);
  const steps: ComboStep[] = [];
  let lastBoard: BoardSnapshot | undefined;
  let worldOnField = false;

  for (const step of walk.steps) {
    if (step.turn < fromTurn || step.turn > toTurn) continue;
    const sideBoard = boardForActor(step.board, actor);
    if (sideBoard.spells.some(isWorldCard)) worldOnField = true;
    if (step.actor === actor && isActionStep(step) && step.cardCodes[0]) {
      steps.push({
        kind: step.kind,
        cardId: step.cardCodes[0],
      });
      lastBoard = step.board;
    } else if (step.turn >= fromTurn && step.turn <= toTurn) {
      lastBoard = step.board;
    }
  }

  const endBoard = lastBoard
    ? boardForActor(lastBoard, actor)
    : { monsters: [], spells: [], grave: [] };

  return {
    actor,
    going,
    openingHand,
    steps,
    endBoard,
    threats: detectThreats(walk, actor, fromTurn, toTurn),
    worldOnField,
    fromTurn,
    toTurn,
  };
}
