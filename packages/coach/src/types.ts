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

export interface PreDuelContext {
  rivalName: string;
  playerDeckName?: string;
  playerDeck?: DeckListSnapshot;
  lesson: MatchupLesson;
}

export interface ChatContext {
  rivalName: string;
  lesson: MatchupLesson;
  history: ChatMessage[];
  userMessage: string;
  playerDeck?: DeckListSnapshot;
}

export interface PostDuelContext {
  rivalName: string;
  lesson: MatchupLesson;
  replayText: string;
  resultHint?: string;
  playerDeck?: DeckListSnapshot;
}

export interface ReplayReviewContext {
  rivalName: string;
  lesson: MatchupLesson;
  steps: ReplayDecisionInput[];
  playerDeck?: DeckListSnapshot;
}

export interface CoachResponse {
  source: "static" | "llm";
  content: string;
  usedModel?: string;
}

export type CoachVerdict = "ok" | "better" | "bad";

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
}
