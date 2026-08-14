import type { ChatMessage, CoachConfig, CoachResponse } from "./types.js";

const DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

export type CompleteChatOptions = {
  json?: boolean;
};

export function hasLlmConfig(config: CoachConfig): boolean {
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

function formatLlmError(status: number, errText: string, model: string): string {
  const looksLikeMissingModel =
    status === 404 ||
    /model[_ ]?not[_ ]?found|does not exist|invalid model|unknown model/i.test(
      errText,
    );
  const hint = looksLikeMissingModel
    ? ` Model "${model}" was rejected by this API. Use a model the provider actually serves (for OpenAI: gpt-4o-mini). Cursor-only names like gpt-5.6-luna will not work.`
    : "";
  return `LLM request failed (${status}): ${errText.slice(0, 400)}${hint}`;
}

async function postChat(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function completeChat(
  config: CoachConfig,
  messages: ChatMessage[],
  fetchImpl: typeof fetch = fetch,
  options: CompleteChatOptions = {},
): Promise<CoachResponse> {
  if (!hasLlmConfig(config)) {
    throw new Error("Missing API key");
  }

  const baseUrl = (config.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
  const model = (config.model || DEFAULT_MODEL).trim();
  const url = `${baseUrl}/chat/completions`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey!.trim()}`,
  };

  const body: Record<string, unknown> = { model, messages };
  if (!omitTemperature(model)) {
    body.temperature = 0.4;
  } else {
    body.max_completion_tokens = 8192;
  }
  if (options.json) {
    body.response_format = { type: "json_object" };
  }

  let res = await postChat(fetchImpl, url, headers, body);
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const retryBody = { ...body };
    let shouldRetry = false;
    if (
      res.status === 400 &&
      /temperature/i.test(errText) &&
      "temperature" in retryBody
    ) {
      delete retryBody.temperature;
      shouldRetry = true;
    } else if (
      res.status === 400 &&
      /response_format|json_object/i.test(errText) &&
      "response_format" in retryBody
    ) {
      delete retryBody.response_format;
      shouldRetry = true;
    }
    if (!shouldRetry) {
      throw new Error(formatLlmError(res.status, errText, model));
    }
    res = await postChat(fetchImpl, url, headers, retryBody);
    if (!res.ok) {
      const retryErr = await res.text().catch(() => "");
      throw new Error(formatLlmError(res.status, retryErr, model));
    }
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: { content?: unknown; refusal?: string };
      text?: string;
    }>;
  };
  const content = extractMessageContent(data);
  if (!content) {
    throw new Error("LLM returned empty content");
  }

  return { source: "llm", content, usedModel: model };
}
