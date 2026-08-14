import { invoke } from "@tauri-apps/api/core";

export interface PathStat {
  path: string;
  exists: boolean;
  isFile: boolean;
  isDir: boolean;
}

export interface DirEntryInfo {
  name: string;
  path: string;
  isFile: boolean;
  modifiedMs: number;
  size: number;
}

export const native = {
  pathStat: (path: string) => invoke<PathStat>("path_stat", { path }),
  readTextFile: (path: string) => invoke<string>("read_text_file", { path }),
  readBinaryFile: (path: string) => invoke<number[]>("read_binary_file", { path }),
  writeTextFile: (path: string, contents: string) =>
    invoke<void>("write_text_file", { path, contents }),
  listDir: (path: string) => invoke<DirEntryInfo[]>("list_dir", { path }),
  openPath: (path: string) => invoke<void>("open_path", { path }),
  homeDir: () => invoke<string>("home_dir"),
  currentDir: () => invoke<string>("current_dir"),
  appDataDir: () => invoke<string>("app_data_dir"),
  decompressYrpx: (path: string) => invoke<string>("decompress_yrpx", { path }),
  queryCardNames: (cdbPath: string, codes: number[]) =>
    invoke<Record<string, string>>("query_card_names", { cdbPath, codes }),
  openaiEnvFallback: () =>
    invoke<{ apiKey?: string; baseUrl?: string; model?: string }>(
      "openai_env_fallback",
    ),
};

export function joinPath(...parts: string[]): string {
  if (parts.length === 0) return "";
  const [first, ...rest] = parts;
  let out = first.replace(/[/\\]+$/, "");
  for (const part of rest) {
    const clean = part.replace(/^[/\\]+/, "").replace(/[/\\]+$/, "");
    if (!clean) continue;
    out = `${out}/${clean}`;
  }
  return out.replace(/\\/g, "/");
}
