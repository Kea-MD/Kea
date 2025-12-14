use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
                
                // Material options (from lightest to darkest):
                // - AppearanceBased, Light, Dark
                // - Titlebar, Selection
                // - Menu, Popover, Sidebar
                // - HeaderView, Sheet, WindowBackground
                // - HudWindow (dark floating panel)
                // - FullScreenUI, ToolTip
                // - ContentBackground, UnderWindowBackground, UnderPageBackground
                // - MediumLight, UltraDark
                
                apply_vibrancy(
                    &window, 
                    NSVisualEffectMaterial::HudWindow,  // Material type
                    Some(NSVisualEffectState::Active),  // Always active blur
                    Some(45.0)                          // Corner radius
                ).expect("Failed to apply vibrancy");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
