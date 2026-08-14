import type { ChatMessage, LlmConfig } from "./types.js";

const DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

export function hasLlmConfig(config: LlmConfig): boolean {
  return Boolean(config.apiKey && config.apiKey.trim());
}

function omitTemperature(model: string): boolean {
  const m = model.trim().toLowerCase();
  return (
    m.startsWith("gpt-5") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4") ||
    m.includes("reason")
  );
}

function extractMessageContent(data: {
  choices?: Array<{
    message?: { content?: unknown; refusal?: string };
    text?: string;
  }>;
}): string {
  const choice = data.choices?.[0];
  const raw = choice?.message?.content;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw)) {
    const joined = raw
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("")
      .trim();
    if (joined) return joined;
  }
  const text = choice?.text?.trim();
  if (text) return text;
  const refusal = choice?.message?.refusal?.trim();
  if (refusal) return refusal;
  return "";
}

export async function completeChat(
  config: LlmConfig,
  messages: ChatMessage[],
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!hasLlmConfig(config)) {
    throw new Error("Missing API key");
  }
  const baseUrl = (config.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
  const model = (config.model || DEFAULT_MODEL).trim();
  const url = `${baseUrl}/chat/completions`;
  const body: Record<string, unknown> = { model, messages };
  if (!omitTemperature(model)) body.temperature = 0.2;
  else body.max_completion_tokens = 4096;
  body.response_format = { type: "json_object" };

  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey!.trim()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${errText.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{
      message?: { content?: unknown; refusal?: string };
      text?: string;
    }>;
  };
  const content = extractMessageContent(data);
  if (!content) throw new Error("LLM returned empty content");
  return content;
}
