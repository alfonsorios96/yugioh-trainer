import type { GoalReview, StepCoaching } from "@yugioh/coach";
import {
  mergeCardNames,
  replaceHashCodes,
  isLastReplayFilename,
  type ReplayFileInfo,
  type ReplayWalkthrough,
  type UnknownCardMeta,
} from "@yugioh/edopro-bridge";
import { listReplays, replayArtPaths } from "./bridgeService";
import { joinPath, native } from "./native";
import type { WalkthroughView } from "../ReplayWalkthrough";

export interface MatchReviewSummary {
  id: string;
  replayName: string;
  replayPath: string;
  replaySize: number;
  replayModifiedMs: number;
  savedAt: number;
  youName: string;
  oppName: string;
  winner: ReplayWalkthrough["winner"];
  stepCount: number;
  rivalName: string;
  rivalId: string;
  source: "static" | "llm";
  usedModel?: string;
  error?: string;
  goalReviews?: GoalReview[];
  academyId?: string;
  drillPrompt?: string;
}

export interface SavedMatchReview extends MatchReviewSummary {
  names: Record<string, string>;
  unknownMeta?: Record<string, UnknownCardMeta>;
  walk: ReplayWalkthrough;
  coaching: StepCoaching[];
}

async function reviewsDir(): Promise<string> {
  return joinPath(await native.appDataDir(), "match-reviews");
}

function indexPath(dir: string): string {
  return joinPath(dir, "index.json");
}

function reviewPath(dir: string, id: string): string {
  return joinPath(dir, `${id}.json`);
}

export async function replayReviewId(file: ReplayFileInfo): Promise<string> {
  const raw = `${file.name}\0${file.size}\0${file.modifiedMs}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isReusableLlmReview(
  review: Pick<MatchReviewSummary, "source" | "error">,
): boolean {
  return review.source === "llm" && !review.error;
}

function toSummary(review: SavedMatchReview): MatchReviewSummary {
  return {
    id: review.id,
    replayName: review.replayName,
    replayPath: review.replayPath,
    replaySize: review.replaySize,
    replayModifiedMs: review.replayModifiedMs,
    savedAt: review.savedAt,
    youName: review.youName,
    oppName: review.oppName,
    winner: review.winner,
    stepCount: review.stepCount,
    rivalName: review.rivalName,
    rivalId: review.rivalId,
    source: review.source,
    usedModel: review.usedModel,
    error: review.error,
  };
}

async function readIndex(dir: string): Promise<MatchReviewSummary[]> {
  try {
    const parsed = JSON.parse(await native.readTextFile(indexPath(dir))) as unknown;
    return Array.isArray(parsed) ? (parsed as MatchReviewSummary[]) : [];
  } catch {
    return [];
  }
}

async function writeIndex(
  dir: string,
  items: MatchReviewSummary[],
): Promise<void> {
  await native.writeTextFile(indexPath(dir), JSON.stringify(items, null, 2));
}

export async function listMatchReviews(): Promise<MatchReviewSummary[]> {
  const items = await readIndex(await reviewsDir());
  return items.sort((a, b) => b.savedAt - a.savedAt);
}

export async function getMatchReview(
  id: string,
): Promise<SavedMatchReview | null> {
  try {
    const raw = await native.readTextFile(
      reviewPath(await reviewsDir(), id),
    );
    return JSON.parse(raw) as SavedMatchReview;
  } catch {
    return null;
  }
}

export async function findReviewForReplay(
  file: ReplayFileInfo,
): Promise<SavedMatchReview | null> {
  return getMatchReview(await replayReviewId(file));
}

export interface ReplayHistoryRow {
  file: ReplayFileInfo;
  reviewId: string;
  review?: MatchReviewSummary;
}

export async function listReplayCatalog(
  replayDir: string,
): Promise<ReplayHistoryRow[]> {
  const files = [...(await listReplays(replayDir))]
    .filter((file) => !isLastReplayFilename(file.name))
    .sort((a, b) => b.modifiedMs - a.modifiedMs);
  const reviews = await listMatchReviews();
  const byId = new Map(reviews.map((item) => [item.id, item]));
  const rows: ReplayHistoryRow[] = [];
  for (const file of files) {
    const reviewId = await replayReviewId(file);
    rows.push({ file, reviewId, review: byId.get(reviewId) });
  }
  return rows;
}

export async function saveMatchReview(
  review: SavedMatchReview,
): Promise<void> {
  const dir = await reviewsDir();
  await native.writeTextFile(reviewPath(dir, review.id), JSON.stringify(review));
  const index = await readIndex(dir);
  const summary = toSummary(review);
  await writeIndex(dir, [
    summary,
    ...index.filter((item) => item.id !== review.id),
  ]);
}

export async function deleteMatchReview(id: string): Promise<void> {
  const dir = await reviewsDir();
  await native.removeFile(reviewPath(dir, id));
  const index = await readIndex(dir);
  await writeIndex(
    dir,
    index.filter((item) => item.id !== id),
  );
}

export function reviewToView(
  review: SavedMatchReview,
  edoProPath: string,
  overlay?: {
    names?: Record<string, string>;
    unknownMeta?: Record<string, UnknownCardMeta>;
  },
): WalkthroughView {
  const names = mergeCardNames(review.names, overlay?.names ?? {});
  const unknownMeta = { ...review.unknownMeta, ...overlay?.unknownMeta };
  return {
    walk: {
      ...review.walk,
      steps: review.walk.steps.map((step) => ({
        ...step,
        chosen: replaceHashCodes(step.chosen, names),
      })),
    },
    names,
    unknownMeta,
    ...replayArtPaths(edoProPath),
    coaching: review.coaching,
    source: review.source,
    error: review.error,
    usedModel: review.usedModel,
    fromCache: true,
    savedAt: review.savedAt,
    goalReviews: review.goalReviews,
    academyId: review.academyId,
    drillPrompt: review.drillPrompt,
  };
}

export function buildSavedReview(input: {
  file: ReplayFileInfo;
  id: string;
  walk: ReplayWalkthrough;
  names: Record<string, string>;
  unknownMeta?: Record<string, UnknownCardMeta>;
  coaching: StepCoaching[];
  source: "static" | "llm";
  error?: string;
  usedModel?: string;
  rivalName: string;
  rivalId: string;
  goalReviews?: GoalReview[];
  academyId?: string;
  drillPrompt?: string;
}): SavedMatchReview {
  return {
    id: input.id,
    replayName: input.file.name,
    replayPath: input.file.path,
    replaySize: input.file.size,
    replayModifiedMs: input.file.modifiedMs,
    savedAt: Date.now(),
    youName: input.walk.youName,
    oppName: input.walk.oppName,
    winner: input.walk.winner,
    stepCount: input.walk.steps.length,
    rivalName: input.rivalName,
    rivalId: input.rivalId,
    source: input.source,
    usedModel: input.usedModel,
    error: input.error,
    names: input.names,
    unknownMeta: input.unknownMeta,
    walk: input.walk,
    coaching: input.coaching,
    goalReviews: input.goalReviews,
    academyId: input.academyId,
    drillPrompt: input.drillPrompt,
  };
}
