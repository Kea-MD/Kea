use tauri::{
    Manager,
    menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    webview::PageLoadEvent,
    Emitter,
    WebviewWindow, WebviewWindowBuilder,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::AtomicBool;
use std::time::Instant;

mod commands;

pub struct FileWatchRegistry {
    pub watchers: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub recent_writes: Arc<Mutex<HashMap<String, (Instant, u64)>>>,
}

impl Default for FileWatchRegistry {
    fn default() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
            recent_writes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[cfg(target_os = "macos")]
fn apply_window_vibrancy(window: &WebviewWindow) -> Result<(), String> {
    use objc2_app_kit::{NSView, NSViewLayerContentsRedrawPolicy};
    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

    apply_vibrancy(
        window,
        NSVisualEffectMaterial::HudWindow,
        Some(NSVisualEffectState::Active),
        Some(45.0),
    )
    .map_err(|error| format!("Failed to apply window vibrancy: {error}"))?;

    window
        .with_webview(|webview| unsafe {
            let view: &NSView = &*webview.inner().cast();
            view.setLayerContentsRedrawPolicy(NSViewLayerContentsRedrawPolicy::DuringViewResize);
        })
        .map_err(|error| format!("Failed to configure live WebView resizing: {error}"))
}

#[cfg(not(target_os = "macos"))]
fn apply_window_vibrancy(_window: &WebviewWindow) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn create_editor_window(app: tauri::AppHandle) -> Result<(), String> {
    let label = (2..)
        .map(|index| format!("kea-{index}"))
        .find(|label| app.get_webview_window(label).is_none())
        .ok_or_else(|| "Unable to allocate a window label".to_string())?;
    let mut config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or_else(|| "Main window configuration is unavailable".to_string())?;
    config.label = label;
    let window = WebviewWindowBuilder::from_config(&app, &config)
        .map_err(|error| format!("Failed to configure new window: {error}"))?
        .on_page_load(|window, payload| {
            if payload.event() == PageLoadEvent::Finished {
                if let Err(error) = apply_window_vibrancy(&window) {
                    eprintln!("{error}");
                }
            }
        })
        .build()
        .map_err(|error| format!("Failed to create new window: {error}"))?;
    apply_window_vibrancy(&window)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .manage(FileWatchRegistry::default())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            apply_window_vibrancy(&window)?;

            // Build native menu
            let handle = app.handle();
            
            // File menu items
            let new_file = MenuItemBuilder::with_id("new_file", "New File")
                .build(handle)?;
            let open_file = MenuItemBuilder::with_id("open_file", "Open...")
                .build(handle)?;
            let open_folder = MenuItemBuilder::with_id("open_folder", "Open Folder...")
                .build(handle)?;
            let save = MenuItemBuilder::with_id("save", "Save")
                .build(handle)?;
            let save_as = MenuItemBuilder::with_id("save_as", "Save As...")
                .build(handle)?;
            let close_tab = MenuItemBuilder::with_id("close_tab", "Close Tab")
                .build(handle)?;

            let file_menu = SubmenuBuilder::new(handle, "File")
                .item(&new_file)
                .separator()
                .item(&open_file)
                .item(&open_folder)
                .separator()
                .item(&save)
                .item(&save_as)
                .separator()
                .item(&close_tab)
                .build()?;

            // Edit menu
            let undo = MenuItemBuilder::with_id("undo", "Undo")
                .build(handle)?;
            let redo = MenuItemBuilder::with_id("redo", "Redo")
                .build(handle)?;
            let cut = PredefinedMenuItem::cut(handle, Some("Cut"))?;
            let copy = PredefinedMenuItem::copy(handle, Some("Copy"))?;
            let paste = PredefinedMenuItem::paste(handle, Some("Paste"))?;
            let select_all = PredefinedMenuItem::select_all(handle, Some("Select All"))?;
            let find = MenuItemBuilder::with_id("find", "Find...")
                .build(handle)?;
            let open_settings = MenuItemBuilder::with_id("open_settings", "Settings...")
                .build(handle)?;

            #[cfg(target_os = "macos")]
            let edit_menu = SubmenuBuilder::new(handle, "Edit")
                .item(&undo)
                .item(&redo)
                .separator()
                .item(&cut)
                .item(&copy)
                .item(&paste)
                .item(&select_all)
                .separator()
                .item(&find)
                .build()?;

            #[cfg(not(target_os = "macos"))]
            let edit_menu = SubmenuBuilder::new(handle, "Edit")
                .item(&undo)
                .item(&redo)
                .separator()
                .item(&cut)
                .item(&copy)
                .item(&paste)
                .item(&select_all)
                .separator()
                .item(&find)
                .separator()
                .item(&open_settings)
                .build()?;

            // View menu
            let toggle_sidebar = MenuItemBuilder::with_id("toggle_sidebar", "Toggle Sidebar")
                .build(handle)?;
            let quick_open = MenuItemBuilder::with_id("quick_open", "Quick Open")
                .build(handle)?;
            let toggle_editor_mode = MenuItemBuilder::with_id(
                "toggle_editor_mode",
                "Toggle Source/Rendered Mode",
            )
                .build(handle)?;

            let view_menu = SubmenuBuilder::new(handle, "View")
                .item(&toggle_sidebar)
                .item(&quick_open)
                .separator()
                .item(&toggle_editor_mode)
                .build()?;

            // Window menu
            let new_window = MenuItemBuilder::with_id("new_window", "New Window")
                .accelerator("CmdOrCtrl+Shift+N")
                .build(handle)?;
            let minimize = PredefinedMenuItem::minimize(handle, Some("Minimise"))?;
            let zoom = PredefinedMenuItem::maximize(handle, Some("Zoom"))?;
            let fullscreen = PredefinedMenuItem::fullscreen(handle, Some("Enter Full Screen"))?;

            let window_menu = SubmenuBuilder::new(handle, "Window")
                .item(&new_window)
                .separator()
                .item(&minimize)
                .item(&zoom)
                .separator()
                .item(&fullscreen)
                .build()?;

            // Build the menu
            #[cfg(target_os = "macos")]
            let about_metadata = AboutMetadataBuilder::new()
                .name(Some(app.package_info().name.clone()))
                .version(Some(app.package_info().version.to_string()))
                .short_version(Some(app.package_info().version.to_string()))
                .icon(app.default_window_icon().cloned())
                .build();

            #[cfg(target_os = "macos")]
            let app_menu = SubmenuBuilder::new(handle, &app.package_info().name)
                .about(Some(about_metadata))
                .separator()
                .item(&open_settings)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            #[cfg(target_os = "macos")]
            let menu = MenuBuilder::new(handle)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&window_menu)
                .build()?;

            #[cfg(not(target_os = "macos"))]
            let menu = MenuBuilder::new(handle)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if let Some(window) = app
                .webview_windows()
                .into_values()
                .find(|window| window.is_focused().unwrap_or(false))
            {
                let _ = app.emit_to(window.label(), "menu-event", id);
            }
        })
        .invoke_handler(tauri::generate_handler![
            create_editor_window,
            commands::file::open_markdown_file,
            commands::file::save_markdown_file,
            commands::file::save_markdown_file_as,
            commands::file::open_folder_dialog,
            commands::file::read_directory,
            commands::file::read_file,
            commands::file::create_file,
            commands::file::create_folder,
            commands::file::rename_item,
            commands::file::delete_item,
            commands::file::move_item,
            commands::file::duplicate_item,
            commands::file::open_item,
            commands::file::reveal_item,
            commands::file::reload_window,
            commands::file::open_devtools,
            commands::file::start_file_watch,
            commands::file::stop_file_watch,
            commands::file::stop_all_file_watches,
            commands::file::store_document_asset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
