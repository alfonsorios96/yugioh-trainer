import type { RivalProfile } from "@yugioh/edopro-bridge";
import type { AcademyItem, MatchupLesson } from "@yugioh/coach";

import rivalsJson from "@content/rivals/index.json";
import academyJson from "@content/academy/fundamentals.json";
import lessonBlueEyes from "@content/lessons/vs-blue-eyes.json";
import lessonSkyStriker from "@content/lessons/vs-sky-striker.json";
import lessonTearlaments from "@content/lessons/vs-tearlaments.json";
import lessonKewlTune from "@content/lessons/vs-kewl-tune.json";
import lessonLightAndDarkness from "@content/lessons/vs-light-and-darkness.json";
import lessonToon2026 from "@content/lessons/vs-toon-2026.json";
import kewlTuneYdk from "@engines/ydk/AI_KewlTune.ydk?raw";
import ladrYdk from "@engines/ydk/AI_LightAndDarkness.ydk?raw";
import toonYdk from "@engines/ydk/AI_Toon2026.ydk?raw";

export const rivals: RivalProfile[] = rivalsJson as RivalProfile[];
export const academy: AcademyItem[] = academyJson as AcademyItem[];

export const lessons: Record<string, MatchupLesson> = {
  "vs-blue-eyes": lessonBlueEyes as MatchupLesson,
  "vs-sky-striker": lessonSkyStriker as MatchupLesson,
  "vs-tearlaments": lessonTearlaments as MatchupLesson,
  "vs-kewl-tune": lessonKewlTune as MatchupLesson,
  "vs-light-and-darkness": lessonLightAndDarkness as MatchupLesson,
  "vs-toon-2026": lessonToon2026 as MatchupLesson,
};

export const META_ENGINE_YDK_FILES: { fileName: string; contents: string }[] = [
  { fileName: "AI_KewlTune.ydk", contents: kewlTuneYdk },
  { fileName: "AI_LightAndDarkness.ydk", contents: ladrYdk },
  { fileName: "AI_Toon2026.ydk", contents: toonYdk },
];

export function getRival(id: string): RivalProfile | undefined {
  return rivals.find((r) => r.id === id);
}

export function genericLesson(rival: RivalProfile): MatchupLesson {
  return {
    id: rival.lessonId,
    rivalId: rival.id,
    title: `Training vs ${rival.name}`,
    summary: `${rival.name} is a WindBot lab rival (${rival.archetype}). Scout their engine, deny the search that completes it, and play to your win condition.`,
    winConditions: [
      "Resolve your engine under interaction",
      "Don't empty follow-up for a flashy board",
    ],
    keyCardsRespect: ["Unknown — generate an LLM lesson or scout game 1"],
    keyCardsNegate: ["The search that completes their engine"],
    tips: [
      {
        title: "Lab matchup",
        body: "No curated notes yet. Ask the coach after you see their first line.",
      },
    ],
    handtrapGuidance: [
      "Hold Ash for the search that completes their engine, not the first optional dig.",
    ],
    commonMistakes: [
      "Goldfishing without respecting unknown interaction",
      "Spending every extender into a single negate",
    ],
  };
}

export function hasCuratedLesson(rival: RivalProfile): boolean {
  return Boolean(lessons[rival.lessonId]);
}

export function getLessonForRival(rival: RivalProfile): MatchupLesson {
  return lessons[rival.lessonId] ?? genericLesson(rival);
}
