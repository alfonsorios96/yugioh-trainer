/** Passcodes used by Toon 2026 combo situations and interruption detection. */

export const ToonId = {
  ComicCat: 72921536,
  FunnyDarkRabbit: 45536531,
  EvilBox: 8915275,
  FacelessMage: 34314989,
  ToonMermaid: 65458948,
  BlueEyesToonDragon: 53183600,
  PerfectWorld: 7293697,
  ToonTableOfContents: 89997728,
  ToonBookmark: 91500017,
  ToonTerror: 53094821,
  MindScan: 34298391,
  ToonWorld: 15259703,
  Terraforming: 73628505,
  BlueEyesToonUltimateDragon: 71808988,
  PerfectronHydradrive: 13203964,
  FirewallDragon: 5043010,
  CharmerQuartet: 27519978,
  Zenna: 7594154,
  CyberseDesavewurm: 92422871,
  Bagooska: 90590303,
  Dugares: 66011101,
  RelinquishedAnima: 94259633,
  CrossSheep: 50277355,
  ProtectcodeTalker: 58036229,
  Zealantis: 45112597,
  Accesscode: 86066372,
} as const;

export const InterruptId = {
  Ash: 14558127,
  MaxxC: 23434538,
  Imperm: 10045474,
  Nibiru: 27204311,
  Veiler: 97268402,
  GhostOgre: 59438930,
} as const;

/** Fallback names when the EDOPro CDB is not available. */
export const KNOWN_CARD_NAMES: Record<number, string> = {
  [ToonId.ComicCat]: "Comic Cat",
  [ToonId.FunnyDarkRabbit]: "Funny Dark Rabbit",
  [ToonId.EvilBox]: "Evil Box",
  [ToonId.FacelessMage]: "Faceless Mage",
  [ToonId.ToonMermaid]: "Toon Mermaid",
  [ToonId.BlueEyesToonDragon]: "Blue-Eyes Toon Dragon",
  [ToonId.PerfectWorld]: "Perfect World",
  [ToonId.ToonTableOfContents]: "Toon Table of Contents",
  [ToonId.ToonBookmark]: "Toon Bookmark",
  [ToonId.ToonTerror]: "Toon Terror",
  [ToonId.MindScan]: "Mind Scan",
  [ToonId.ToonWorld]: "Toon World",
  [ToonId.Terraforming]: "Terraforming",
  [ToonId.BlueEyesToonUltimateDragon]: "Blue-Eyes Toon Ultimate Dragon",
  [ToonId.PerfectronHydradrive]: "Perfectron Hydradrive Dragon",
  [ToonId.FirewallDragon]: "Firewall Dragon",
  [ToonId.CharmerQuartet]: "Charmer Quartet in Bloom",
  [ToonId.Zenna]: "Zenna's Deceiving Doll Maidens",
  [ToonId.CyberseDesavewurm]: "Cyberse Desavewurm",
  [ToonId.Bagooska]: "Number 41: Bagooska the Terribly Tired Tapir",
  [ToonId.Dugares]: "Number 60: Dugares the Timeless",
  [ToonId.RelinquishedAnima]: "Relinquished Anima",
  [ToonId.CrossSheep]: "Cross-Sheep",
  [ToonId.ProtectcodeTalker]: "Protectcode Talker",
  [ToonId.Zealantis]: "Worldsea Dragon Zealantis",
  [ToonId.Accesscode]: "Accesscode Talker",
  [InterruptId.Ash]: "Ash Blossom & Joyous Spring",
  [InterruptId.MaxxC]: "Maxx \"C\"",
  [InterruptId.Imperm]: "Infinite Impermanence",
  [InterruptId.Nibiru]: "Nibiru, the Primal Being",
  [InterruptId.Veiler]: "Effect Veiler",
  [InterruptId.GhostOgre]: "Ghost Ogre & Snow Rabbit",
};

export const BOT_NAME_HINTS = [
  "toon 2026",
  "toon2026",
  "windbot",
  "ai toon",
];

export function isWorldCard(id: number): boolean {
  return id === ToonId.PerfectWorld || id === ToonId.ToonWorld;
}

export function isToonSearchStarter(id: number): boolean {
  return (
    id === ToonId.ToonBookmark ||
    id === ToonId.ToonTableOfContents ||
    id === ToonId.Terraforming
  );
}

const EXTRA_DECK_IDS = new Set<number>([
  ToonId.BlueEyesToonUltimateDragon,
  ToonId.Dugares,
  ToonId.RelinquishedAnima,
  ToonId.CrossSheep,
  ToonId.PerfectronHydradrive,
  ToonId.Zealantis,
  ToonId.FirewallDragon,
  ToonId.ProtectcodeTalker,
  ToonId.CharmerQuartet,
  ToonId.Zenna,
  ToonId.CyberseDesavewurm,
  ToonId.Bagooska,
  ToonId.Accesscode,
]);

export function isExtraDeckMonster(id: number): boolean {
  return EXTRA_DECK_IDS.has(id);
}

/** Effects that Special Summon a main-deck monster as a selection, not a Bind(SpSummon). */
export function isEffectSummoner(id: number): boolean {
  return (
    id === ToonId.ComicCat ||
    id === ToonId.Dugares ||
    id === ToonId.CrossSheep ||
    id === ToonId.CharmerQuartet ||
    id === ToonId.ProtectcodeTalker
  );
}

export function isSearcher(id: number): boolean {
  return (
    isToonSearchStarter(id) ||
    id === ToonId.PerfectWorld ||
    id === ToonId.ToonWorld ||
    id === ToonId.EvilBox ||
    id === ToonId.FunnyDarkRabbit ||
    id === ToonId.BlueEyesToonUltimateDragon
  );
}

export const NO_EXTENDER_SEARCHERS = [
  ToonId.ToonBookmark,
  ToonId.ToonTableOfContents,
  ToonId.Terraforming,
] as const;
