// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

const APP_DISPLAY_NAME: &str = "WindBot Lab";

fn main() {
    #[cfg(target_os = "macos")]
    set_macos_process_name(APP_DISPLAY_NAME);

    bot_lab_lib::run()
}

#[cfg(target_os = "macos")]
fn set_macos_process_name(name: &str) {
    use objc2_foundation::{NSProcessInfo, NSString};

    let process_info = NSProcessInfo::processInfo();
    process_info.setProcessName(&NSString::from_str(name));
}
