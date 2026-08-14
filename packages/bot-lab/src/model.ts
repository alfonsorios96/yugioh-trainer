import { ToonId } from "./cards.js";
import type { ComboEdge, ComboModel, ComboNode } from "./types.js";

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
