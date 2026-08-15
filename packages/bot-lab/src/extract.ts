import type {
  Actor,
  BoardSnapshot,
  ReplayStep,
  ReplayWalkthrough,
} from "@yugioh/edopro-bridge";
import { BOT_NAME_HINTS, InterruptId, ToonId, isWorldCard } from "./cards.js";
import { emptyEndBoard } from "./book.js";
import type {
  ComboStep,
  ComboStepKind,
  EndBoard,
  Going,
} from "./types.js";
import {
  compactZones,
  MONSTER_ZONE_SLOTS,
  padStances,
  padZones,
  placeLabel,
  SPELL_ZONE_SLOTS,
  stanceFromPos,
} from "./zones.js";

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

const TOON_PASSCODES = new Set<number>(Object.values(ToonId));

export function guessBotActor(walk: ReplayWalkthrough): Actor {
  const you = walk.youName.toLowerCase();
  const opp = walk.oppName.toLowerCase();
  if (BOT_NAME_HINTS.some((h) => opp.includes(h))) return "opp";
  if (BOT_NAME_HINTS.some((h) => you.includes(h))) return "you";
  let youHits = 0;
  let oppHits = 0;
  for (const step of walk.steps) {
    if (!isActionStep(step)) continue;
    const playedToon = step.cardCodes.some((id) => TOON_PASSCODES.has(id));
    if (!playedToon) continue;
    if (step.actor === "you") youHits += 1;
    else oppHits += 1;
  }
  if (youHits > oppHits) return "you";
  if (oppHits > youHits) return "opp";
  return "opp";
}

/** First duel turn where this actor summoned/activated/set a card. */
export function firstActionTurn(
  walk: ReplayWalkthrough,
  actor: Actor,
): number {
  const hit = walk.steps.find(
    (s) => s.actor === actor && isActionStep(s) && s.turn >= 1 && s.cardCodes[0],
  );
  return hit?.turn ?? 1;
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
  const monsters = actor === "you" ? board.youMonsters : board.oppMonsters;
  const spells = actor === "you" ? board.youSpells : board.oppSpells;
  const grave = actor === "you" ? board.youGrave : board.oppGrave;
  const banished = actor === "you" ? board.youBanished : board.oppBanished;
  const monsterZones = padZones(
    monsters.map((c) => c.code),
    MONSTER_ZONE_SLOTS,
  );
  const spellZones = padZones(
    spells.map((c) => c.code),
    SPELL_ZONE_SLOTS,
  );
  const monsterStances = padStances(
    monsters.map((c) => stanceFromPos(c.pos)),
    MONSTER_ZONE_SLOTS,
  );
  const spellStances = padStances(
    spells.map((c) => {
      const stance = stanceFromPos(c.pos);
      return stance === "set" ? "set" : "";
    }),
    SPELL_ZONE_SLOTS,
  );
  return {
    monsters: compactZones(monsterZones),
    spells: compactZones(spellZones),
    grave: grave.map((c) => c.code).filter((id) => id > 0),
    banished: (banished ?? []).map((c) => c.code).filter((id) => id > 0),
    monsterZones,
    spellZones,
    monsterStances,
    spellStances,
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
      const onField =
        step.kind === "set" ||
        ((step.loc ?? 0) & 0x0c) !== 0;
      const stance = onField ? stanceFromPos(step.pos, step.kind) : "";
      steps.push({
        kind: step.kind,
        cardId: step.cardCodes[0],
        place:
          step.loc !== undefined && step.seq !== undefined
            ? placeLabel(step.loc, step.seq)
            : undefined,
        stance: stance === "def" || stance === "set" ? stance : undefined,
      });
      lastBoard = step.board;
    } else if (step.turn >= fromTurn && step.turn <= toTurn) {
      lastBoard = step.board;
    }
  }

  const endBoard = lastBoard
    ? boardForActor(lastBoard, actor)
    : emptyEndBoard();

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

export function extractComboLine(
  walk: ReplayWalkthrough,
  actor: Actor = guessBotActor(walk),
): ExtractedLine {
  const turn = firstActionTurn(walk, actor);
  return extractLine(walk, actor, { fromTurn: turn, toTurn: turn });
}
