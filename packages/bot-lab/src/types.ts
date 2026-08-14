export type Going = "first" | "second";

export type ComboStepKind = "activate" | "summon" | "spsummon" | "set";

export interface EndBoard {
  monsters: number[];
  spells: number[];
  grave: number[];
}

export interface ComboStep {
  kind: ComboStepKind;
  cardId: number;
  selectCard?: number[];
  selectNextCard?: number[];
}

export interface SituationWhen {
  going?: Going;
  handContains?: number[];
  handExcludes?: number[];
  worldOnField?: boolean;
  threats?: string[];
  oppMonstersMin?: number;
}

export interface ComboExample {
  sourceReplay: string;
  notes?: string;
  openingHand?: number[];
  steps: ComboStep[];
  endBoard: EndBoard;
  endBoardAcceptable?: EndBoard;
}

export interface ComboSituation {
  situationId: string;
  title: string;
  notes: string;
  when: SituationWhen;
  examples: ComboExample[];
  steps: ComboStep[];
  endBoard: EndBoard;
  endBoardAcceptable?: EndBoard;
}

export interface ComboBook {
  deckId: string;
  engineFile: string;
  situations: ComboSituation[];
}

export type ComboEdgeKind = "requires" | "enables" | "window" | "recovers";

export interface ComboNode {
  id: string;
  label: string;
  cardIds?: number[];
}

export interface ComboEdge {
  from: string;
  to: string;
  kind: ComboEdgeKind;
  note?: string;
}

export interface ComboModel {
  deckId: string;
  nodes: ComboNode[];
  edges: ComboEdge[];
}

export type PatchKind = "selectCard" | "selectNextCard";

export interface EnginePatch {
  kind: PatchKind;
  cardId: number;
  ids: number[];
  callIndex?: number;
}

export type DiagnosisVerdict =
  | "ok"
  | "wrong-search"
  | "no-recovery"
  | "overextend"
  | "unknown";

export interface Diagnosis {
  verdict: DiagnosisVerdict;
  situationId: string | null;
  score: number;
  notes: string;
  expectedEndBoard?: EndBoard;
  actualEndBoard?: EndBoard;
  missingFromBoard?: number[];
}

export interface LearningEntry {
  at: number;
  replay: string;
  verdict: DiagnosisVerdict;
  situationId: string | null;
  applied: boolean;
  patches: EnginePatch[];
  undoPatches: EnginePatch[];
  reason?: string;
  origin: "gold" | "learned" | "bot";
}

export interface LlmConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LearnCycleResult {
  diagnosis: Diagnosis;
  patches: EnginePatch[];
  applied: boolean;
  nextSource?: string;
  reason?: string;
  entry: LearningEntry;
}
