/** Event protocol between WindBot AgentExecutor, yugioh_agentic, and Bot Lab. */

export type AgentGoing = "first" | "second";
export type AgentMode = "follow" | "improvise" | "safe-pass";
export type AgentActionKind =
  | "summon"
  | "spsummon"
  | "activate"
  | "set"
  | "to_ep"
  | "select"
  | "announce"
  | "repos"
  | "chain"
  | "option";

export interface AgentPlayerState {
  lp: number;
  hand: number[];
  monsters: number[];
  spells: number[];
  grave?: number[];
  banished?: number[];
  extra?: number[];
  monsterZones?: number[];
  spellZones?: number[];
  monsterStances?: string[];
  spellStances?: string[];
}

export interface TeachContext {
  turn: number;
  phase: string;
  going: string;
  promptKind: string;
  threats: string[];
  self: AgentPlayerState;
  opp: AgentPlayerState;
  constraints?: AgentConstraints;
}

export interface AgentConstraints {
  normalSummonUsed?: boolean;
  summonCount?: number;
  selectRole?: string | null;
  chainPlayer?: number | null;
  selectMin?: number;
  selectMax?: number;
  selectCancelable?: boolean;
  selectHint?: number | null;
}

export interface AgentLegalAction {
  id: string;
  kind: AgentActionKind | string;
  cardId?: number | null;
  place?: string | null;
  label?: string | null;
  desc?: number | null;
  optionIndex?: number | null;
}

export interface DecisionRequest {
  requestId: string;
  duelId: string;
  turn: number;
  phase: string;
  going: AgentGoing | string;
  self: AgentPlayerState;
  opp: AgentPlayerState;
  legalActions: AgentLegalAction[];
  constraints?: AgentConstraints;
  threats?: string[];
  promptKind?: string;
  deckId?: string;
}

export interface RankedAction {
  actionId: string;
  kind: string;
  cardId?: number | null;
  score: number;
  why: string;
  label?: string | null;
  desc?: number | null;
}

export interface DecisionProposal {
  requestId: string;
  top5: RankedAction[];
  othersCount: number;
  situationId: string | null;
  mode: AgentMode | string;
  targetBoard: string;
  legalActions: AgentLegalAction[];
  scores: Record<string, number>;
  knowledgeUsed?: string[];
  rankMs?: number;
  context?: TeachContext | null;
}

export interface UserChoice {
  requestId: string;
  actionId: string;
  actionIds?: string[] | null;
  note?: string | null;
}

export interface DecisionResponse {
  requestId: string;
  actionId: string;
  actionIds?: string[];
  kind?: string | null;
  cardId?: number | null;
  cardIds?: number[];
  desc?: number | null;
  optionIndex?: number | null;
  fromTop5: boolean;
  situationId: string | null;
  mode: AgentMode | string;
  scores: Record<string, number>;
}

export const AGENT_DEFAULT_URL = "http://127.0.0.1:8765";

export function isLegalActionId(request: DecisionRequest, actionId: string): boolean {
  return request.legalActions.some((a) => a.id === actionId);
}

export function actionInTop5(proposal: DecisionProposal, actionId: string): boolean {
  return proposal.top5.some((a) => a.actionId === actionId);
}
