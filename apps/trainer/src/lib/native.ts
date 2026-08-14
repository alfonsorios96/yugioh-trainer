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

export interface LaunchResult {
  ok: boolean;
  message: string;
  command: string;
}

export const native = {
  pathStat: (path: string) => invoke<PathStat>("path_stat", { path }),
  readTextFile: (path: string) => invoke<string>("read_text_file", { path }),
  readBinaryFile: (path: string) => invoke<number[]>("read_binary_file", { path }),
  writeTextFile: (path: string, contents: string) =>
    invoke<void>("write_text_file", { path, contents }),
  listDir: (path: string) => invoke<DirEntryInfo[]>("list_dir", { path }),
  copyFile: (from: string, to: string) => invoke<void>("copy_file", { from, to }),
  openPath: (path: string) => invoke<void>("open_path", { path }),
  launchExecutable: (candidates: string[], args: string[], cwd?: string) =>
    invoke<LaunchResult>("launch_executable", { candidates, args, cwd }),
  launchWindbot: (cwd: string, args: string[]) =>
    invoke<LaunchResult>("launch_windbot", { cwd, args }),
  homeDir: () => invoke<string>("home_dir"),
  appDataDir: () => invoke<string>("app_data_dir"),
  removeFile: (path: string) => invoke<void>("remove_file", { path }),
  checkTcp: (host: string, port: number) =>
    invoke<boolean>("check_tcp", { host, port }),
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
