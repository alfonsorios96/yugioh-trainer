export interface LessonTip {
  title: string;
  body: string;
}

export interface MatchupLesson {
  id: string;
  rivalId: string;
  title: string;
  summary: string;
  winConditions: string[];
  keyCardsRespect: string[];
  keyCardsNegate: string[];
  tips: LessonTip[];
  handtrapGuidance: string[];
  commonMistakes: string[];
}

export interface AcademyItem {
  id: string;
  title: string;
  body: string;
  category: "fundamentals" | "tempo" | "resources" | "chains";
}

export interface CoachConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Resolved player .ydk: English names, one entry per copy. */
export interface DeckListSnapshot {
  name: string;
  main: string[];
  extra: string[];
  side: string[];
}

export type SessionFocus =
  | "going-first"
  | "going-second"
  | "handtraps"
  | "resources"
  | "wincon";

export interface SessionGoal {
  id: string;
  text: string;
  focus: SessionFocus;
  academyId?: string;
}

export interface SessionPlan {
  deckSummary: string;
  starters: string[];
  chokePoints: string[];
  goingFirst: string;
  goingSecond: string;
  goals: SessionGoal[];
  academyIds: string[];
  source: "static" | "llm";
  usedModel?: string;
}

export interface DeckPlanContext {
  rivalName: string;
  lesson: MatchupLesson;
  playerDeck?: DeckListSnapshot;
}

export interface PreDuelContext {
  rivalName: string;
  playerDeckName?: string;
  playerDeck?: DeckListSnapshot;
  lesson: MatchupLesson;
  sessionGoals?: SessionGoal[];
}

export interface ChatContext {
  rivalName: string;
  lesson: MatchupLesson;
  history: ChatMessage[];
  userMessage: string;
  playerDeck?: DeckListSnapshot;
  sessionGoals?: SessionGoal[];
}

export interface PostDuelContext {
  rivalName: string;
  lesson: MatchupLesson;
  replayText: string;
  resultHint?: string;
  playerDeck?: DeckListSnapshot;
  sessionGoals?: SessionGoal[];
}

export interface ReplayReviewContext {
  rivalName: string;
  lesson: MatchupLesson;
  steps: ReplayDecisionInput[];
  playerDeck?: DeckListSnapshot;
  sessionGoals?: SessionGoal[];
  drillKind?: DrillKind;
}

export interface CoachResponse {
  source: "static" | "llm";
  content: string;
  usedModel?: string;
}

export type DrillKind = "open" | "going-first" | "going-second" | "handtrap";

export type CoachVerdict = "ok" | "better" | "bad";

export interface GoalReview {
  goalId: string;
  met: boolean;
  note: string;
}

export interface ReplayDecisionInput {
  id: number;
  turn: number;
  phase: string;
  kind: string;
  chosen: string;
  actor: "you" | "opp";
  decision: boolean;
}

export interface StepCoaching {
  id: number;
  verdict: CoachVerdict;
  explanation: string;
  betterLine?: string;
}
