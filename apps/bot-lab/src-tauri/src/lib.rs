use base64::{engine::general_purpose::STANDARD, Engine as _};
use lzma_rs::decompress::{Options, UnpackedSize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathExistsResult {
    pub path: String,
    pub exists: bool,
    pub is_file: bool,
    pub is_dir: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntryInfo {
    pub name: String,
    pub path: String,
    pub is_file: bool,
    pub modified_ms: u64,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResult {
    pub ok: bool,
    pub message: String,
    pub command: String,
}

fn meta_modified_ms(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
fn path_stat(path: String) -> PathExistsResult {
    let p = PathBuf::from(&path);
    let exists = p.exists();
    PathExistsResult {
        path,
        exists,
        is_file: exists && p.is_file(),
        is_dir: exists && p.is_dir(),
    }
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {path}: {e}"))
}

#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read {path}: {e}"))
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {e}"))?;
    }
    fs::write(&path, contents).map_err(|e| format!("Failed to write {path}: {e}"))
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<DirEntryInfo>, String> {
    let entries = fs::read_dir(&path).map_err(|e| format!("Failed to read dir {path}: {e}"))?;
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let meta = entry.metadata().ok();
        let file_type = entry.file_type().ok();
        let is_file = file_type.as_ref().map(|t| t.is_file()).unwrap_or(false);
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified_ms = meta.as_ref().map(meta_modified_ms).unwrap_or(0);
        out.push(DirEntryInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_file,
            modified_ms,
            size,
        });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

#[tauri::command]
fn copy_file(from: String, to: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&to).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {e}"))?;
    }
    fs::copy(&from, &to).map_err(|e| format!("Failed to copy {from} -> {to}: {e}"))?;
    Ok(())
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open {path}: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open {path}: {e}"))?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open {path}: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", unix)))]
    {
        Err(format!("Unsupported platform for open_path: {path}"))
    }
}

fn first_existing(candidates: &[String]) -> Option<String> {
    candidates.iter().find(|p| Path::new(p).exists()).cloned()
}

#[tauri::command]
fn launch_executable(candidates: Vec<String>, args: Vec<String>, cwd: Option<String>) -> LaunchResult {
    let Some(exe) = first_existing(&candidates) else {
        return LaunchResult {
            ok: false,
            message: format!(
                "No executable found among candidates: {}",
                candidates.join(", ")
            ),
            command: candidates.join(" | "),
        };
    };

    let mut cmd = Command::new(&exe);
    cmd.args(&args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    match cmd.spawn() {
        Ok(_) => LaunchResult {
            ok: true,
            message: format!("Launched {exe}"),
            command: format!("{} {}", exe, args.join(" ")),
        },
        Err(e) => LaunchResult {
            ok: false,
            message: format!("Failed to launch {exe}: {e}"),
            command: format!("{} {}", exe, args.join(" ")),
        },
    }
}

#[tauri::command]
fn launch_windbot(cwd: String, args: Vec<String>) -> LaunchResult {
    let candidates = vec![
        format!("{cwd}/WindBot"),
        format!("{cwd}/WindBot.exe"),
        format!("{cwd}/windbot"),
        format!("{cwd}/windbot.exe"),
    ];

    // Prefer mono/dotnet for .exe on macOS/Linux when native binary missing
    if let Some(exe) = first_existing(&candidates) {
        return launch_executable(vec![exe], args, Some(cwd));
    }

    let dll = format!("{cwd}/WindBot.dll");
    if Path::new(&dll).exists() {
        let mut cmd = Command::new("dotnet");
        cmd.arg(&dll).args(&args).current_dir(&cwd);
        return match cmd.spawn() {
            Ok(_) => LaunchResult {
                ok: true,
                message: format!("Launched via dotnet {dll}"),
                command: format!("dotnet {} {}", dll, args.join(" ")),
            },
            Err(e) => LaunchResult {
                ok: false,
                message: format!("dotnet launch failed: {e}. Try mono or install WindBot binary."),
                command: format!("dotnet {} {}", dll, args.join(" ")),
            },
        };
    }

    // Last resort: mono WindBot.exe if present elsewhere naming
    let mono_exe = format!("{cwd}/WindBot.exe");
    if Path::new(&mono_exe).exists() {
        let mut cmd = Command::new("mono");
        cmd.arg(&mono_exe).args(&args).current_dir(&cwd);
        return match cmd.spawn() {
            Ok(_) => LaunchResult {
                ok: true,
                message: format!("Launched via mono {mono_exe}"),
                command: format!("mono {} {}", mono_exe, args.join(" ")),
            },
            Err(e) => LaunchResult {
                ok: false,
                message: format!("mono launch failed: {e}"),
                command: format!("mono {} {}", mono_exe, args.join(" ")),
            },
        };
    }

    LaunchResult {
        ok: false,
        message: format!(
            "WindBot executable not found in {cwd}. Launch EDOPro and start AI from the client, or install WindBot into the game folder."
        ),
        command: format!("(missing) {}", args.join(" ")),
    }
}

#[tauri::command]
fn home_dir() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not resolve home directory".to_string())
}

#[tauri::command]
fn current_dir() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_file(path: String) -> Result<(), String> {
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Failed to delete {path}: {e}")),
    }
}

const REPLAY_COMPRESSED: u32 = 0x1;
const REPLAY_EXTENDED_HEADER: u32 = 0x200;

/// Decompress an EDOPro .yrpX into raw packet bytes (base64).
#[tauri::command]
fn decompress_yrpx(path: String) -> Result<String, String> {
    let data = fs::read(&path).map_err(|e| format!("Failed to read {path}: {e}"))?;
    if data.len() < 32 {
        return Err("Replay file too small".into());
    }
    let flag = u32::from_le_bytes(data[8..12].try_into().unwrap());
    let datasize = u32::from_le_bytes(data[16..20].try_into().unwrap()) as usize;
    let props = &data[24..29];
    let header_len: usize = if flag & REPLAY_EXTENDED_HEADER != 0 {
        72
    } else {
        32
    };
    if data.len() < header_len {
        return Err("Replay header truncated".into());
    }
    let compressed = &data[header_len..];
    if flag & REPLAY_COMPRESSED == 0 {
        return Ok(STANDARD.encode(compressed));
    }

    let mut output = Vec::new();
    let opts = Options {
        unpacked_size: UnpackedSize::UseProvided(Some(datasize as u64)),
        allow_incomplete: true,
        ..Options::default()
    };
    let mut prefixed = Vec::with_capacity(5 + compressed.len());
    prefixed.extend_from_slice(props);
    prefixed.extend_from_slice(compressed);
    let mut input = Cursor::new(prefixed);
    lzma_rs::lzma_decompress_with_options(&mut input, &mut output, &opts)
        .map_err(|e| format!("LZMA decompress failed: {e}"))?;
    Ok(STANDARD.encode(output))
}

#[tauri::command]
fn query_card_names(cdb_path: String, codes: Vec<u32>) -> Result<HashMap<String, String>, String> {
    let mut out = HashMap::new();
    if codes.is_empty() {
        return Ok(out);
    }
    if !Path::new(&cdb_path).exists() {
        return Err(format!("cards.cdb not found: {cdb_path}"));
    }
    let unique: Vec<u32> = {
        let mut v = codes;
        v.sort_unstable();
        v.dedup();
        v
    };
    for chunk in unique.chunks(400) {
        let list = chunk
            .iter()
            .map(|c| c.to_string())
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!("SELECT id, name FROM texts WHERE id IN ({list});");
        let output = Command::new("sqlite3")
            .args(["-separator", "|", &cdb_path, &sql])
            .output()
            .map_err(|e| format!("sqlite3 failed: {e}"))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).into());
        }
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            if let Some((id, name)) = line.split_once('|') {
                out.insert(id.trim().to_string(), name.trim().to_string());
            }
        }
    }
    Ok(out)
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OpenaiEnvFallback {
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
}

fn parse_openai_dotenv(contents: &str) -> OpenaiEnvFallback {
    let mut out = OpenaiEnvFallback::default();
    for raw in contents.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value
            .trim()
            .trim_matches('"')
            .trim_matches('\'')
            .to_string();
        if value.is_empty() {
            continue;
        }
        match key.trim() {
            "OPENAI_API_KEY" => out.api_key = Some(value),
            "OPENAI_BASE_URL" => out.base_url = Some(value),
            "OPENAI_MODEL" => out.model = Some(value),
            _ => {}
        }
    }
    out
}

#[tauri::command]
fn openai_env_fallback() -> OpenaiEnvFallback {
    let mut dir = std::env::current_dir().ok();
    for _ in 0..8 {
        let Some(current) = dir else {
            break;
        };
        for name in [".env.local", ".env"] {
            let path = current.join(name);
            if let Ok(contents) = fs::read_to_string(&path) {
                let parsed = parse_openai_dotenv(&contents);
                if parsed.api_key.is_some() {
                    return parsed;
                }
            }
        }
        dir = current.parent().map(|p| p.to_path_buf());
    }
    OpenaiEnvFallback::default()
}

/// Returns true if a TCP connection to host:port succeeds within ~900ms.
#[tauri::command]
fn check_tcp(host: String, port: u16) -> Result<bool, String> {
    let addr = format!("{host}:{port}");
    let mut addrs = addr
        .to_socket_addrs()
        .map_err(|e| format!("Could not resolve {addr}: {e}"))?;
    let sock = addrs
        .next()
        .ok_or_else(|| format!("No address for {addr}"))?;
    match TcpStream::connect_timeout(&sock, Duration::from_millis(900)) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            path_stat,
            read_text_file,
            read_binary_file,
            write_text_file,
            list_dir,
            copy_file,
            open_path,
            launch_executable,
            launch_windbot,
            home_dir,
            current_dir,
            app_data_dir,
            remove_file,
            check_tcp,
            decompress_yrpx,
            query_card_names,
            openai_env_fallback,
        ])
        .setup(|app| {
            let _ = app.path().app_data_dir();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
