import { LazyStore } from "@tauri-apps/plugin-store";
import { native } from "./native";

export interface LabSettings {
  edoProPath: string;
  apiKey: string;
  apiBaseUrl: string;
  apiModel: string;
  comboRoot: string;
}

const DEFAULTS: LabSettings = {
  edoProPath: "",
  apiKey: "",
  apiBaseUrl: "https://api.openai.com/v1",
  apiModel: "gpt-4o-mini",
  comboRoot: "",
};

let store: LazyStore | null = null;

function getStore(): LazyStore {
  if (!store) store = new LazyStore("bot-lab-settings.json");
  return store;
}

async function applyEnvFallbacks(settings: LabSettings): Promise<LabSettings> {
  if (settings.apiKey.trim()) return settings;
  try {
    const env = await native.openaiEnvFallback();
    return {
      ...settings,
      apiKey: env.apiKey?.trim() || settings.apiKey,
      apiBaseUrl: settings.apiBaseUrl.trim()
        ? settings.apiBaseUrl
        : env.baseUrl?.trim() || settings.apiBaseUrl,
    };
  } catch {
    return settings;
  }
}

export async function loadSettings(): Promise<LabSettings> {
  try {
    const s = getStore();
    const entries = await Promise.all(
      (Object.keys(DEFAULTS) as (keyof LabSettings)[]).map(async (key) => {
        const value = await s.get<LabSettings[typeof key]>(key);
        return [key, value ?? DEFAULTS[key]] as const;
      }),
    );
    return applyEnvFallbacks({ ...DEFAULTS, ...Object.fromEntries(entries) } as LabSettings);
  } catch {
    return applyEnvFallbacks({ ...DEFAULTS });
  }
}

export async function saveSettings(partial: Partial<LabSettings>): Promise<void> {
  const s = getStore();
  for (const [key, value] of Object.entries(partial)) {
    await s.set(key, value);
  }
  await s.save();
}

export { DEFAULTS as defaultSettings };
