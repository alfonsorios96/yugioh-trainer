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
} as const;

export const InterruptId = {
  Ash: 14558127,
  MaxxC: 23434538,
  Imperm: 10045474,
  Nibiru: 27204311,
  Veiler: 97268402,
  GhostOgre: 59438930,
} as const;

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
