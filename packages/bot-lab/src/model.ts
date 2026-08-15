import { KNOWN_CARD_NAMES, ToonId } from "./cards.js";
import type {
  ComboBook,
  ComboEdge,
  ComboEdgeKind,
  ComboModel,
  ComboNode,
} from "./types.js";

export function defaultToonComboModel(): ComboModel {
  const nodes: ComboNode[] = [
    { id: "bookmark", label: "Toon Bookmark search", cardIds: [ToonId.ToonBookmark] },
    { id: "table", label: "Toon Table of Contents", cardIds: [ToonId.ToonTableOfContents] },
    { id: "terraforming", label: "Terraforming", cardIds: [ToonId.Terraforming] },
    {
      id: "perfect-world",
      label: "Perfect World on field",
      cardIds: [ToonId.PerfectWorld, ToonId.ToonWorld],
    },
    {
      id: "rabbit",
      label: "Funny Dark Rabbit extra NS",
      cardIds: [ToonId.FunnyDarkRabbit],
    },
    { id: "comic-cat", label: "Comic Cat tribute", cardIds: [ToonId.ComicCat] },
    {
      id: "blue-eyes-toon",
      label: "Blue-Eyes Toon Dragon",
      cardIds: [ToonId.BlueEyesToonDragon],
    },
    { id: "faceless", label: "Faceless Mage", cardIds: [ToonId.FacelessMage] },
    { id: "evil-box", label: "Evil Box search Terror", cardIds: [ToonId.EvilBox] },
    { id: "terror-set", label: "Toon Terror set", cardIds: [ToonId.ToonTerror] },
    {
      id: "ultimate",
      label: "Blue-Eyes Toon Ultimate Dragon",
      cardIds: [ToonId.BlueEyesToonUltimateDragon],
    },
    { id: "mind-scan", label: "Mind Scan", cardIds: [ToonId.MindScan] },
  ];

  const edges: ComboEdge[] = [
    { from: "bookmark", to: "perfect-world", kind: "enables", note: "Busca Perfect World" },
    { from: "terraforming", to: "perfect-world", kind: "enables" },
    { from: "table", to: "perfect-world", kind: "enables", note: "O Bookmark si World ya está" },
    { from: "perfect-world", to: "rabbit", kind: "enables", note: "Ignition busca Rabbit" },
    { from: "perfect-world", to: "comic-cat", kind: "requires" },
    { from: "rabbit", to: "comic-cat", kind: "enables", note: "Extra Normal Summon" },
    { from: "comic-cat", to: "blue-eyes-toon", kind: "enables" },
    { from: "comic-cat", to: "faceless", kind: "enables" },
    { from: "blue-eyes-toon", to: "ultimate", kind: "enables" },
    { from: "evil-box", to: "terror-set", kind: "enables" },
    { from: "faceless", to: "mind-scan", kind: "enables" },
    { from: "bookmark", to: "ash-window", kind: "window", note: "Ash pega en Bookmark" },
    { from: "table", to: "ash-window", kind: "window" },
    { from: "perfect-world", to: "ash-window", kind: "window", note: "Ash en la búsqueda" },
    { from: "ash-window", to: "table", kind: "recovers", note: "Otra magia starter" },
    { from: "ash-window", to: "terraforming", kind: "recovers" },
    { from: "ash-window", to: "terror-set", kind: "recovers", note: "Pasar con Terror" },
  ];

  nodes.push({ id: "ash-window", label: "Ventana Ash / negate de search" });

  return { deckId: "toon-2026", nodes, edges };
}

export function recoveriesFrom(model: ComboModel, nodeId: string): ComboEdge[] {
  return model.edges.filter((e) => e.kind === "recovers" && e.from === nodeId);
}

export function windowsOn(model: ComboModel, nodeId: string): ComboEdge[] {
  return model.edges.filter((e) => e.kind === "window" && e.from === nodeId);
}

function cardNodeId(cardId: number): string {
  return `c-${cardId}`;
}

function threatNodeId(threat: string): string {
  return `t-${threat}`;
}

function cardLabel(cardId: number): string {
  return KNOWN_CARD_NAMES[cardId] ?? `#${cardId}`;
}

function threatLabel(threat: string): string {
  if (threat === "ash") return "Ash";
  if (threat === "maxx-c") return "Maxx C";
  if (threat === "imperm") return "Imperm";
  if (threat === "nibiru") return "Nibiru";
  if (threat === "veiler") return "Veiler";
  if (threat === "ghost-ogre") return "Ghost Ogre";
  return threat;
}

/** Builds the combo graph from the situation book so it stays in sync on compile. */
export function modelFromBook(book: ComboBook): ComboModel {
  const nodes = new Map<string, ComboNode>();
  const edges: ComboEdge[] = [];
  const seen = new Set<string>();

  const addNode = (id: string, label: string, cardIds?: number[]) => {
    if (!nodes.has(id)) nodes.set(id, { id, label, cardIds });
  };
  const addCard = (cardId: number) => {
    if (cardId <= 0) return;
    addNode(cardNodeId(cardId), cardLabel(cardId), [cardId]);
  };
  const addEdge = (
    from: string,
    to: string,
    kind: ComboEdgeKind,
    note?: string,
  ) => {
    if (from === to || !nodes.has(from) || !nodes.has(to)) return;
    const key = `${from}|${to}|${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, kind, note });
  };

  for (const sit of book.situations) {
    for (const step of sit.steps) {
      addCard(step.cardId);
      for (const id of step.selectCard ?? []) addCard(id);
      for (const id of step.selectNextCard ?? []) addCard(id);
    }
    for (const id of sit.endBoard.monsters) addCard(id);
    for (const id of sit.endBoard.spells) addCard(id);
    for (const id of sit.endBoard.grave) addCard(id);
    for (const id of sit.endBoard.banished ?? []) addCard(id);
    if (sit.when.worldOnField) addCard(ToonId.PerfectWorld);
    for (const threat of sit.when.threats ?? []) {
      addNode(threatNodeId(threat), threatLabel(threat));
    }
  }

  for (const sit of book.situations) {
    for (const step of sit.steps) {
      const from = cardNodeId(step.cardId);
      for (const id of step.selectCard ?? []) {
        addEdge(from, cardNodeId(id), "enables", `${sit.title}: elige`);
      }
      for (const id of step.selectNextCard ?? []) {
        addEdge(from, cardNodeId(id), "enables", `${sit.title}: luego`);
      }
    }
    for (let i = 0; i < sit.steps.length - 1; i++) {
      addEdge(
        cardNodeId(sit.steps[i].cardId),
        cardNodeId(sit.steps[i + 1].cardId),
        "enables",
        sit.title,
      );
    }
    if (sit.when.worldOnField && sit.steps[0]) {
      addEdge(
        cardNodeId(ToonId.PerfectWorld),
        cardNodeId(sit.steps[0].cardId),
        "requires",
        sit.title,
      );
    }
    for (const threat of sit.when.threats ?? []) {
      const tid = threatNodeId(threat);
      const first = sit.steps[0];
      const last = sit.steps[sit.steps.length - 1];
      if (first) addEdge(cardNodeId(first.cardId), tid, "window", sit.title);
      if (last) addEdge(tid, cardNodeId(last.cardId), "recovers", sit.title);
    }
  }

  return { deckId: book.deckId, nodes: [...nodes.values()], edges };
}
