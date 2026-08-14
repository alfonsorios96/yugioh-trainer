// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

const APP_DISPLAY_NAME: &str = "TCG Yugi Trainer";

fn main() {
    #[cfg(target_os = "macos")]
    set_macos_process_name(APP_DISPLAY_NAME);

    trainer_lib::run()
}

/// `tauri dev` runs the Cargo binary (`trainer`), so macOS Dock/menu use that
/// name. Set it before AppKit starts so the tooltip matches productName.
#[cfg(target_os = "macos")]
fn set_macos_process_name(name: &str) {
    use objc2_foundation::{NSProcessInfo, NSString};

    let process_info = NSProcessInfo::processInfo();
    process_info.setProcessName(&NSString::from_str(name));
}
