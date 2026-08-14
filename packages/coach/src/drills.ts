import type { DrillKind, SessionGoal } from "./types.js";

export const DRILL_OPTIONS: {
  id: DrillKind;
  label: string;
  hint: string;
}[] = [
  {
    id: "open",
    label: "Duelo libre",
    hint: "Partida completa con los 3 objetivos de la sesión.",
  },
  {
    id: "going-first",
    label: "Going first",
    hint: "Combo bajo 1 handtrap; guarda follow-up.",
  },
  {
    id: "going-second",
    label: "Going second",
    hint: "Rompe el board sin vaciar el turno.",
  },
  {
    id: "handtrap",
    label: "Lab de handtrap",
    hint: "Una decisión: ¿Ash / Imperm / Nibiru ahora?",
  },
];

export function drillGoals(kind: DrillKind, rivalName: string): SessionGoal[] | null {
  if (kind === "open") return null;
  if (kind === "going-first") {
    return [
      {
        id: "d-gf-1",
        text: `Going first vs ${rivalName}: resolve your combo under 1 handtrap.`,
        focus: "going-first",
        academyId: "normal-summon",
      },
      {
        id: "d-gf-2",
        text: "Keep follow-up if they break you on their turn.",
        focus: "resources",
        academyId: "resources",
      },
      {
        id: "d-gf-3",
        text: "Do not spend the Normal Summon on a dead body.",
        focus: "going-first",
        academyId: "normal-summon",
      },
    ];
  }
  if (kind === "going-second") {
    return [
      {
        id: "d-gs-1",
        text: `Going second vs ${rivalName}: break without emptying the turn.`,
        focus: "going-second",
        academyId: "tempo",
      },
      {
        id: "d-gs-2",
        text: "Play through at least one negate; keep a second threat.",
        focus: "resources",
        academyId: "resources",
      },
      {
        id: "d-gs-3",
        text: "If you cannot win this turn, set up next turn instead of all-in.",
        focus: "wincon",
        academyId: "tempo",
      },
    ];
  }
  return [
    {
      id: "d-ht-1",
      text: `Vs ${rivalName}: spend Ash / Imperm only on the search that completes their engine.`,
      focus: "handtraps",
      academyId: "ash-timing",
    },
    {
      id: "d-ht-2",
      text: "If you pass on a handtrap, say why out loud (or to the coach).",
      focus: "handtraps",
      academyId: "chain-priority",
    },
    {
      id: "d-ht-3",
      text: "Do not panic-Nibiru if their board is already contained.",
      focus: "handtraps",
      academyId: "tempo",
    },
  ];
}

export function drillPrompt(kind: DrillKind): string {
  if (kind === "going-first") {
    return "En el replay, salta a tus decisiones del primer turno. ¿Resolviste el combo bajo interacción?";
  }
  if (kind === "going-second") {
    return "En el replay, salta a tu primer turno going second. ¿El break dejó follow-up?";
  }
  if (kind === "handtrap") {
    return "Filtra errores y revisa cada handtrap: ¿era el choke point o un dig opcional?";
  }
  return "Revisa el primer error y rehaz esa decisión en voz alta antes de la siguiente partida.";
}
