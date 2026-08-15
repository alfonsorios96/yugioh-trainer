import type { DecisionProposal, UserChoice } from "@yugioh/edopro-bridge";
import { AGENT_DEFAULT_URL } from "@yugioh/edopro-bridge";

export async function fetchPending(baseUrl = AGENT_DEFAULT_URL): Promise<DecisionProposal | null> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/pending`);
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`pending ${res.status}`);
  return (await res.json()) as DecisionProposal;
}

export async function submitChoice(
  choice: UserChoice,
  baseUrl = AGENT_DEFAULT_URL,
): Promise<void> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/choice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(choice),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `choice ${res.status}`);
  }
}

export interface InterpretResult {
  actionId: string | null;
  kind: string | null;
  cardId: number | null;
  rationale: string;
  source: string;
  matched: boolean;
}

export async function interpretOther(
  input: {
    requestId: string;
    prompt: string;
    execute?: boolean;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  },
  agentUrl = AGENT_DEFAULT_URL,
): Promise<InterpretResult> {
  const res = await fetch(`${agentUrl.replace(/\/$/, "")}/v1/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as InterpretResult & { error?: string };
  if (res.status === 404) throw new Error(data.error || "No hay un prompt pendiente");
  return data;
}

export async function pingAgent(baseUrl = AGENT_DEFAULT_URL): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/health`);
    return res.ok;
  } catch {
    return false;
  }
}
