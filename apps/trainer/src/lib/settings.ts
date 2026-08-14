import { LazyStore } from "@tauri-apps/plugin-store";
import { native } from "./native";

export interface AppSettings {
  edoProPath: string;
  apiKey: string;
  apiBaseUrl: string;
  apiModel: string;
  windBotHost: string;
  windBotPort: number;
  selectedRivalId: string;
  selectedDeckPath: string;
}

const DEFAULTS: AppSettings = {
  edoProPath: "",
  apiKey: "",
  apiBaseUrl: "https://api.openai.com/v1",
  apiModel: "gpt-4o-mini",
  windBotHost: "127.0.0.1",
  windBotPort: 7911,
  selectedRivalId: "blue-eyes",
  selectedDeckPath: "",
};

let store: LazyStore | null = null;

function getStore(): LazyStore {
  if (!store) {
    store = new LazyStore("settings.json");
  }
  return store;
}

async function applyEnvFallbacks(settings: AppSettings): Promise<AppSettings> {
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

export async function loadSettings(): Promise<AppSettings> {
  try {
    const s = getStore();
    const entries = await Promise.all(
      (Object.keys(DEFAULTS) as (keyof AppSettings)[]).map(async (key) => {
        const value = await s.get<AppSettings[typeof key]>(key);
        return [key, value ?? DEFAULTS[key]] as const;
      }),
    );
    const loaded = { ...DEFAULTS, ...Object.fromEntries(entries) } as AppSettings;
    return applyEnvFallbacks(loaded);
  } catch {
    return applyEnvFallbacks({ ...DEFAULTS });
  }
}

export async function saveSettings(partial: Partial<AppSettings>): Promise<void> {
  const s = getStore();
  for (const [key, value] of Object.entries(partial)) {
    await s.set(key, value);
  }
  await s.save();
}

export { DEFAULTS as defaultSettings };
