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
    id: "kewl-tune",
    name: "Kewl Tune",
    deck: "KewlTune",
    ydkFileName: "AI_KewlTune.ydk",
    difficulty: 4,
    masterRules: [5],
  },
  {
    id: "light-and-darkness",
    name: "Light and Darkness",
    deck: "LightAndDarkness",
    ydkFileName: "AI_LightAndDarkness.ydk",
    difficulty: 4,
    masterRules: [5],
  },
  {
    id: "toon-2026",
    name: "Toon 2026",
    deck: "Toon2026",
    ydkFileName: "AI_Toon2026.ydk",
    difficulty: 3,
    masterRules: [5],
  },
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
  "src/Engines/StapleEngine.cs",
  "src/Engines/KewlTuneEngine.cs",
  "src/Engines/LightAndDarknessEngine.cs",
  "src/Engines/ToonEngine.cs",
  "src/Decks/KewlTuneExecutor.cs",
  "src/Decks/LightAndDarknessExecutor.cs",
  "src/Decks/ToonExecutor.cs",
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
