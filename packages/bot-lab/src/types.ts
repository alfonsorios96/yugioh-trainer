export type Going = "first" | "second";

export type ComboStepKind = "activate" | "summon" | "spsummon" | "set";

/** How a card sits on the field. Empty string = unused slot. */
export type CardStance = "atk" | "def" | "set" | "";

export interface EndBoard {
  monsters: number[];
  spells: number[];
  grave: number[];
  banished: number[];
  /** MZ1–MZ5 then EMZ / EMZ2. 0 = empty. */
  monsterZones?: number[];
  /** ST1–ST5 then Field. 0 = empty. */
  spellZones?: number[];
  monsterStances?: CardStance[];
  spellStances?: CardStance[];
}

export interface ComboStep {
  kind: ComboStepKind;
  cardId: number;
  selectCard?: number[];
  selectNextCard?: number[];
  /** Field slot when this action lands on a zone (MZ1, EMZ, ST3, Campo…). */
  place?: string;
  stance?: CardStance;
  /** True when this spsummon is the result of the previous effect, not a Bind. */
  isOutcome?: boolean;
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
  /** Tie-breaker when two situations match a replay. Lower = fallback line. */
  priority?: number;
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
