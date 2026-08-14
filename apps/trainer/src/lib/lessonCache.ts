import type { MatchupLesson } from "@yugioh/coach";
import { joinPath, native } from "./native";

function safeLessonFile(rivalId: string): string {
  return rivalId.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

async function lessonsDir(): Promise<string> {
  return joinPath(await native.appDataDir(), "lab-lessons");
}

export async function loadCachedLabLesson(
  rivalId: string,
): Promise<MatchupLesson | null> {
  try {
    const raw = await native.readTextFile(
      joinPath(await lessonsDir(), `${safeLessonFile(rivalId)}.json`),
    );
    const parsed = JSON.parse(raw) as MatchupLesson;
    if (!parsed?.title || !Array.isArray(parsed.winConditions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCachedLabLesson(
  rivalId: string,
  lesson: MatchupLesson,
): Promise<void> {
  await native.writeTextFile(
    joinPath(await lessonsDir(), `${safeLessonFile(rivalId)}.json`),
    JSON.stringify(lesson, null, 2),
  );
}
