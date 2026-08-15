import { ToonId, isToonSearchStarter } from "./cards.js";
import type { CardStance, ComboStep, ComboStepKind } from "./types.js";

export interface ComboLineBeat {
  verb: string;
  verbTitle: string;
  code: number;
  kind: ComboStepKind;
  place?: string;
  stance?: CardStance;
}

const SEARCHERS = new Set<number>([
  ToonId.ToonBookmark,
  ToonId.ToonTableOfContents,
  ToonId.Terraforming,
  ToonId.PerfectWorld,
  ToonId.EvilBox,
]);

function isSearcher(id: number) {
  return SEARCHERS.has(id) || isToonSearchStarter(id);
}

function collapseSummonActivate(steps: ComboStep[]): ComboStep[] {
  const out: ComboStep[] = [];
  for (const step of steps) {
    const prev = out[out.length - 1];
    if (
      step.kind === "activate" &&
      prev &&
      (prev.kind === "summon" || prev.kind === "spsummon") &&
      prev.cardId === step.cardId
    ) {
      out[out.length - 1] = {
        ...prev,
        selectCard: prev.selectCard?.length ? prev.selectCard : step.selectCard,
        selectNextCard: prev.selectNextCard?.length
          ? prev.selectNextCard
          : step.selectNextCard,
      };
      continue;
    }
    out.push({ ...step });
  }
  return out;
}

export function openingVerb(step: ComboStep): { verb: string; verbTitle: string } {
  if (step.kind === "summon" || step.kind === "spsummon") {
    return { verb: "invoca", verbTitle: "Invoca" };
  }
  if (step.kind === "set") {
    return { verb: "coloca", verbTitle: "Coloca boca abajo" };
  }
  if (isSearcher(step.cardId)) {
    return { verb: "busca", verbTitle: "Busca" };
  }
  return { verb: "activa", verbTitle: "Activa" };
}

export function verbBetween(
  from: ComboStep,
  to: ComboStep,
): { verb: string; verbTitle: string } {
  if (from.selectCard?.includes(to.cardId)) {
    return { verb: "busca", verbTitle: "Busca" };
  }
  if (from.selectNextCard?.includes(to.cardId)) {
    if (from.cardId === ToonId.ComicCat) {
      return { verb: "sacrifica", verbTitle: "Sacrifica e invoca" };
    }
    return { verb: "invoca", verbTitle: "Invoca" };
  }
  if (from.cardId === to.cardId) {
    if (to.kind === "summon" || to.kind === "spsummon") {
      return { verb: "recicla", verbTitle: "Sale y vuelve (soft OPT)" };
    }
    return { verb: "activa", verbTitle: "Activa de nuevo" };
  }
  if (
    from.cardId === ToonId.ComicCat &&
    (to.kind === "spsummon" || to.kind === "summon")
  ) {
    return { verb: "sacrifica", verbTitle: "Sacrifica e invoca" };
  }
  if (
    from.cardId === ToonId.FacelessMage &&
    (to.kind === "set" || to.cardId === ToonId.MindScan)
  ) {
    return { verb: "coloca", verbTitle: "Coloca desde la mano" };
  }
  if (from.cardId === ToonId.Zenna) {
    return { verb: "envía", verbTitle: "Envía a cementerio" };
  }
  if (
    from.cardId === ToonId.CharmerQuartet ||
    from.cardId === ToonId.FirewallDragon
  ) {
    return { verb: "recupera", verbTitle: "Recupera al campo o a la mano" };
  }
  if (
    from.kind === "activate" &&
    isSearcher(from.cardId) &&
    to.kind !== "summon" &&
    to.kind !== "spsummon"
  ) {
    return { verb: "busca", verbTitle: "Busca" };
  }
  if (to.kind === "summon" || to.kind === "spsummon") {
    return { verb: "invoca", verbTitle: "Invoca" };
  }
  if (to.kind === "set") {
    return { verb: "coloca", verbTitle: "Coloca boca abajo" };
  }
  if (from.kind === "activate" || to.kind === "activate") {
    return { verb: "activa", verbTitle: "Activa" };
  }
  return { verb: "luego", verbTitle: "Siguiente paso" };
}

function extraBeats(step: ComboStep, nextId: number | undefined): ComboLineBeat[] {
  const seen = new Set<number>([step.cardId]);
  if (nextId) seen.add(nextId);
  const beats: ComboLineBeat[] = [];
  for (const code of step.selectCard ?? []) {
    if (seen.has(code)) continue;
    seen.add(code);
    beats.push({
      verb: "busca",
      verbTitle: "Busca",
      code,
      kind: step.kind,
    });
  }
  for (const code of step.selectNextCard ?? []) {
    if (seen.has(code)) continue;
    seen.add(code);
    beats.push({
      verb: step.cardId === ToonId.ComicCat ? "sacrifica" : "invoca",
      verbTitle:
        step.cardId === ToonId.ComicCat ? "Sacrifica e invoca" : "Invoca",
      code,
      kind: "spsummon",
    });
  }
  return beats;
}

/** Compact flowchart beats: verb + card, collapsing NS/SS followed by activate. */
export function buildComboLine(steps: ComboStep[]): ComboLineBeat[] {
  const collapsed = collapseSummonActivate(steps);
  const beats: ComboLineBeat[] = [];
  for (let i = 0; i < collapsed.length; i++) {
    const step = collapsed[i];
    const prev = collapsed[i - 1];
    const lead = prev ? verbBetween(prev, step) : openingVerb(step);
    beats.push({
      ...lead,
      code: step.cardId,
      kind: step.kind,
      place: step.place,
      stance: step.stance,
    });
    beats.push(...extraBeats(step, collapsed[i + 1]?.cardId));
  }
  return beats;
}
