import type { RivalProfile } from "@yugioh/edopro-bridge";
import type { MatchupLesson } from "@yugioh/coach";

import rivalsJson from "@content/rivals/index.json";
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

export function getLessonForRival(rival: RivalProfile): MatchupLesson {
  const lesson = lessons[rival.lessonId];
  if (!lesson) {
    throw new Error(`Missing lesson ${rival.lessonId}`);
  }
  return lesson;
}
