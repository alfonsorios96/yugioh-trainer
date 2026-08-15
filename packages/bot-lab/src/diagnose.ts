import { InterruptId, ToonId, isToonSearchStarter, isWorldCard } from "./cards.js";
import type { ExtractedLine } from "./extract.js";
import { extractComboLine } from "./extract.js";
import { matchEndBoard, sequencePrefixLength, stepCardSequence } from "./match.js";
import type {
  ComboBook,
  ComboSituation,
  Diagnosis,
  Going,
} from "./types.js";
import type { Actor, ReplayWalkthrough } from "@yugioh/edopro-bridge";

function handHas(
  hand: number[],
  ids: number[] | undefined,
  mode: "all" | "none",
): boolean {
  if (!ids || ids.length === 0) return true;
  if (mode === "all") return ids.every((id) => hand.includes(id));
  return ids.every((id) => !hand.includes(id));
}

function situationScore(sit: ComboSituation, line: ExtractedLine): number {
  const w = sit.when;
  let score = 0;
  if (w.going && w.going === line.going) score += 3;
  else if (w.going && w.going !== line.going) score -= 5;
  if (handHas(line.openingHand, w.handContains, "all")) score += 2;
  else if (w.handContains?.length) score -= 2;
  if (handHas(line.openingHand, w.handExcludes, "none")) score += 1;
  else if (w.handExcludes?.length) score -= 3;
  if (typeof w.worldOnField === "boolean") {
    score += w.worldOnField === line.worldOnField ? 2 : -2;
  }
  const threats = new Set(line.threats);
  if (w.threats?.length) {
    const hit = w.threats.filter((t) => threats.has(t)).length;
    score += hit * 4;
    if (hit === 0) score -= 2;
  }
  score += sit.priority ?? 0;
  const seq = stepCardSequence(sit.steps);
  const actual = stepCardSequence(line.steps);
  score += sequencePrefixLength(seq, actual);
  return score;
}

export function classifySituation(
  book: ComboBook,
  line: ExtractedLine,
): ComboSituation | null {
  if (book.situations.length === 0) return null;
  let best: ComboSituation | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const sit of book.situations) {
    const score = situationScore(sit, line);
    if (score > bestScore) {
      bestScore = score;
      best = sit;
    }
  }
  if (!best || bestScore < 1) return null;
  return best;
}

function hasMaxxC(line: ExtractedLine): boolean {
  return line.threats.includes("maxx-c");
}

function searchWasNegated(line: ExtractedLine): boolean {
  return line.threats.some((t) => t === "ash" || t === "veiler" || t === "ghost-ogre");
}

function playedFullCombo(line: ExtractedLine): boolean {
  return line.steps.some((s) => s.cardId === ToonId.BlueEyesToonUltimateDragon);
}

export function diagnoseLine(book: ComboBook, line: ExtractedLine): Diagnosis {
  const sit = classifySituation(book, line);
  if (!sit) {
    return {
      verdict: "unknown",
      situationId: null,
      score: 0,
      notes: "Ninguna situación del libro encaja con esta partida.",
      actualEndBoard: line.endBoard,
    };
  }

  const expected = sit.endBoard;
  const acceptable = sit.endBoardAcceptable;
  const primary = matchEndBoard(expected, line.endBoard);
  const fallback = acceptable
    ? matchEndBoard(acceptable, line.endBoard)
    : { ok: false, missing: primary.missing };
  const boardOk = primary.ok || fallback.ok;

  if (sit.when.threats?.includes("maxx-c") || hasMaxxC(line)) {
    if (playedFullCombo(line) && sit.situationId === "maxx-c") {
      return {
        verdict: "overextend",
        situationId: sit.situationId,
        score: situationScore(sit, line),
        notes: "Maxx C activo y el bot extendió hasta Ultimate.",
        expectedEndBoard: expected,
        actualEndBoard: line.endBoard,
      };
    }
  }

  if (searchWasNegated(line) && sit.situationId !== "ash-on-search") {
    const recovered = line.steps.some(
      (s) => isToonSearchStarter(s.cardId) || s.cardId === ToonId.ToonTerror,
    );
    if (!recovered && !boardOk) {
      return {
        verdict: "no-recovery",
        situationId: sit.situationId,
        score: situationScore(sit, line),
        notes: "Hubo Ash/negate en search y no tomó la rama de recuperación.",
        expectedEndBoard: expected,
        actualEndBoard: line.endBoard,
        missingFromBoard: primary.missing,
      };
    }
  }

  if (boardOk) {
    return {
      verdict: "ok",
      situationId: sit.situationId,
      score: situationScore(sit, line),
      notes: `Llegó al campo de ${sit.situationId}.`,
      expectedEndBoard: expected,
      actualEndBoard: line.endBoard,
    };
  }

  const expectedSeq = stepCardSequence(sit.steps);
  const actualSeq = stepCardSequence(line.steps);
  const prefix = sequencePrefixLength(expectedSeq, actualSeq);
  const searchedWrong =
    sit.steps.some((s) => (s.selectCard?.length ?? 0) > 0) && prefix < expectedSeq.length;

  if (searchedWrong) {
    return {
      verdict: "wrong-search",
      situationId: sit.situationId,
      score: situationScore(sit, line),
      notes: `La secuencia se desvió en el paso ${prefix} de ${sit.situationId}.`,
      expectedEndBoard: expected,
      actualEndBoard: line.endBoard,
      missingFromBoard: primary.missing,
    };
  }

  return {
    verdict: "wrong-search",
    situationId: sit.situationId,
    score: situationScore(sit, line),
    notes: `No llegó al endBoard de ${sit.situationId}.`,
    expectedEndBoard: expected,
    actualEndBoard: line.endBoard,
    missingFromBoard: primary.missing,
  };
}

export function diagnoseReplay(
  book: ComboBook,
  walk: ReplayWalkthrough,
  actor: Actor,
): Diagnosis {
  const line = extractComboLine(walk, actor);
  return diagnoseLine(book, line);
}

export function inferGoing(line: ExtractedLine): Going {
  return line.going;
}

export function lineHasWorld(line: ExtractedLine): boolean {
  return line.worldOnField || line.endBoard.spells.some(isWorldCard);
}

export function sawInterrupt(line: ExtractedLine, id: number): boolean {
  if (id === InterruptId.Ash) return line.threats.includes("ash");
  if (id === InterruptId.MaxxC) return line.threats.includes("maxx-c");
  return false;
}
