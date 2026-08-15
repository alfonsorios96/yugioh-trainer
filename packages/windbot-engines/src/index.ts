export interface MetaEngineDeck {
  id: string;
  name: string;
  deck: string;
  ydkFileName: string;
  difficulty: number;
  masterRules: number[];
}

export const META_ENGINE_DLL = "YgoTrainerEngines.dll";
export const META_ENGINE_MARKER = ".ygo-trainer-engines.json";

export const META_ENGINE_DECKS: MetaEngineDeck[] = [
  {
    id: "toon-2026-agent",
    name: "Toon 2026 Agent",
    deck: "Toon2026Agent",
    ydkFileName: "AI_Toon2026.ydk",
    difficulty: 3,
    masterRules: [5],
  },
];

export const META_ENGINE_SOURCE_FILES = [
  "src/MetaExecutor.cs",
  "src/Engines/ToonEngine.cs",
  "src/Decks/ToonAgentExecutor.cs",
] as const;

export function isMetaEngineDeck(deckKey: string): boolean {
  const needle = deckKey.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return META_ENGINE_DECKS.some(
    (d) => d.deck.toLowerCase().replace(/[\s_-]+/g, "") === needle,
  );
}

export function engineYdkCandidates(): string[] {
  return META_ENGINE_DECKS.map((d) => d.ydkFileName);
}
