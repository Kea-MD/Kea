use tauri::{
    Manager,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, PredefinedMenuItem},
    Emitter,
};

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
                
                apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::HudWindow,
                    Some(NSVisualEffectState::Active),
                    Some(45.0)
                ).expect("Failed to apply vibrancy");
            }

            // Build native menu
            let handle = app.handle();
            
            // File menu items
            let new_file = MenuItemBuilder::with_id("new_file", "New File")
                .accelerator("CmdOrCtrl+N")
                .build(handle)?;
            let open_file = MenuItemBuilder::with_id("open_file", "Open...")
                .accelerator("CmdOrCtrl+O")
                .build(handle)?;
            let open_folder = MenuItemBuilder::with_id("open_folder", "Open Folder...")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(handle)?;
            let save = MenuItemBuilder::with_id("save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(handle)?;
            let save_as = MenuItemBuilder::with_id("save_as", "Save As...")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(handle)?;
            let close_tab = MenuItemBuilder::with_id("close_tab", "Close Tab")
                .accelerator("CmdOrCtrl+W")
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
                .accelerator("CmdOrCtrl+Z")
                .build(handle)?;
            let redo = MenuItemBuilder::with_id("redo", "Redo")
                .accelerator("CmdOrCtrl+Shift+Z")
                .build(handle)?;
            let cut = PredefinedMenuItem::cut(handle, Some("Cut"))?;
            let copy = PredefinedMenuItem::copy(handle, Some("Copy"))?;
            let paste = PredefinedMenuItem::paste(handle, Some("Paste"))?;
            let select_all = PredefinedMenuItem::select_all(handle, Some("Select All"))?;
            let find = MenuItemBuilder::with_id("find", "Find...")
                .accelerator("CmdOrCtrl+F")
                .build(handle)?;

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

            // View menu
            let toggle_sidebar = MenuItemBuilder::with_id("toggle_sidebar", "Toggle Sidebar")
                .accelerator("CmdOrCtrl+\\")
                .build(handle)?;
            let quick_open = MenuItemBuilder::with_id("quick_open", "Quick Open")
                .accelerator("CmdOrCtrl+P")
                .build(handle)?;

            let view_menu = SubmenuBuilder::new(handle, "View")
                .item(&toggle_sidebar)
                .item(&quick_open)
                .build()?;

            // Window menu
            let minimize = PredefinedMenuItem::minimize(handle, Some("Minimise"))?;
            let zoom = PredefinedMenuItem::maximize(handle, Some("Zoom"))?;
            let fullscreen = PredefinedMenuItem::fullscreen(handle, Some("Enter Full Screen"))?;

            let window_menu = SubmenuBuilder::new(handle, "Window")
                .item(&minimize)
                .item(&zoom)
                .separator()
                .item(&fullscreen)
                .build()?;

            // Build the menu
            #[cfg(target_os = "macos")]
            let menu = MenuBuilder::new(handle)
                .item(&PredefinedMenuItem::services(handle, None)?)
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
            // Emit event to frontend
            let _ = app.emit("menu-event", id);
        })
        .invoke_handler(tauri::generate_handler![
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
