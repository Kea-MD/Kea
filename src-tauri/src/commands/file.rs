use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::thread;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter, State};
use crate::FileWatchRegistry;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileData {
    pub path: String,
    pub content: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveResult {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_markdown: bool,
    pub children: Option<Vec<FileEntry>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FolderData {
    pub path: String,
    pub name: String,
    pub entries: Vec<FileEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileWatchEvent {
    pub path: String,
    pub kind: String,
}

fn atomic_write_file(path: &Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("Invalid file path: missing parent directory")?;

    if !parent.exists() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("document");

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to read system time: {}", e))?
        .as_nanos();

    let temp_path = parent.join(format!(".{}.kea.{}.tmp", file_name, timestamp));

    let write_result = (|| -> Result<(), String> {
        let mut temp_file = fs::File::create(&temp_path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;

        temp_file
            .write_all(content.as_bytes())
            .map_err(|e| format!("Failed to write temp file: {}", e))?;

        temp_file
            .sync_all()
            .map_err(|e| format!("Failed to flush temp file: {}", e))?;

        Ok(())
    })();

    if let Err(error) = write_result {
        let _ = fs::remove_file(&temp_path);
        return Err(error);
    }

    if fs::rename(&temp_path, path).is_ok() {
        return Ok(());
    }

    if path.exists() {
        fs::remove_file(path)
            .map_err(|e| format!("Failed to replace existing file: {}", e))?;
    }

    fs::rename(&temp_path, path)
        .map_err(|e| format!("Failed to move temp file into place: {}", e))?;

    Ok(())
}

fn read_modified_time(path: &Path) -> Option<SystemTime> {
    fs::metadata(path).ok()?.modified().ok()
}

/// Open a markdown file using file picker
#[tauri::command]
pub async fn open_markdown_file(app: AppHandle) -> Result<FileData, String> {
    use tauri_plugin_dialog::DialogExt;

    // Open file picker dialog
    let file_path = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_file();

    match file_path {
        Some(file_path) => {
            // Convert FilePath to PathBuf
            let path = file_path
                .into_path()
                .map_err(|_| "Invalid file path")?;

            // Read file content
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            // Get file name
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Untitled")
                .to_string();

            // Convert path to string
            let path_str = path
                .to_str()
                .ok_or("Invalid file path")?
                .to_string();

            Ok(FileData {
                path: path_str,
                content,
                name,
            })
        }
        None => Err("No file selected".to_string()),
    }
}

/// Save markdown content to specified file path
#[tauri::command]
pub async fn save_markdown_file(path: String, content: String) -> Result<(), String> {
    atomic_write_file(Path::new(&path), &content)?;

    Ok(())
}

/// Save markdown content with file picker (Save As)
#[tauri::command]
pub async fn save_markdown_file_as(app: AppHandle, content: String) -> Result<SaveResult, String> {
    use tauri_plugin_dialog::DialogExt;

    // Open save dialog
    let file_path = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md"])
        .set_file_name("Untitled.md")
        .blocking_save_file();

    match file_path {
        Some(file_path) => {
            // Convert FilePath to PathBuf
            let mut path = file_path
                .into_path()
                .map_err(|_| "Invalid file path")?;

            // Ensure .md extension
            if path.extension().is_none() {
                path.set_extension("md");
            }

            // Write content
            atomic_write_file(&path, &content)?;

            // Get file name
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Untitled.md")
                .to_string();

            // Convert path to string
            let path_str = path
                .to_str()
                .ok_or("Invalid file path")?
                .to_string();

            Ok(SaveResult {
                path: path_str,
                name,
            })
        }
        None => Err("Save cancelled".to_string()),
    }
}

/// Check if a file extension is markdown
fn is_markdown_file(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => matches!(ext.to_lowercase().as_str(), "md" | "markdown" | "mdown" | "mkd"),
        None => false,
    }
}

/// Read directory entries recursively (with depth limit)
fn read_dir_entries(path: &Path, depth: u32, max_depth: u32) -> Result<Vec<FileEntry>, String> {
    let mut entries: Vec<FileEntry> = Vec::new();
    
    let dir_entries = fs::read_dir(path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in dir_entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let entry_path = entry.path();
        let metadata = entry.metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        
        let name = entry_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        
        // Skip hidden files and directories
        if name.starts_with('.') {
            continue;
        }
        
        let path_str = entry_path.to_str()
            .ok_or("Invalid path encoding")?
            .to_string();
        
        let is_dir = metadata.is_dir();
        let is_markdown = if is_dir { false } else { is_markdown_file(&entry_path) };
        
        let children = if is_dir && depth < max_depth {
            Some(read_dir_entries(&entry_path, depth + 1, max_depth)?)
        } else if is_dir {
            Some(Vec::new()) // Empty children, can be loaded lazily
        } else {
            None
        };
        
        entries.push(FileEntry {
            name,
            path: path_str,
            is_dir,
            is_markdown,
            children,
        });
    }
    
    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(entries)
}

/// Open a folder using folder picker
#[tauri::command]
pub async fn open_folder_dialog(app: AppHandle) -> Result<FolderData, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder_path = app
        .dialog()
        .file()
        .blocking_pick_folder();

    match folder_path {
        Some(folder_path) => {
            let path = folder_path
                .into_path()
                .map_err(|_| "Invalid folder path")?;

            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Folder")
                .to_string();

            let path_str = path
                .to_str()
                .ok_or("Invalid folder path")?
                .to_string();

            // Read directory entries (2 levels deep initially)
            let entries = read_dir_entries(&path, 0, 2)?;

            Ok(FolderData {
                path: path_str,
                name,
                entries,
            })
        }
        None => Err("No folder selected".to_string()),
    }
}

/// Read directory contents (for lazy loading)
#[tauri::command]
pub async fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    
    if !dir_path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    if !dir_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    read_dir_entries(dir_path, 0, 1)
}

/// Read a file's content
#[tauri::command]
pub async fn read_file(path: String) -> Result<FileData, String> {
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }
    
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled")
        .to_string();
    
    Ok(FileData {
        path,
        content,
        name,
    })
}

/// Create a new file
#[tauri::command]
pub async fn create_file(path: String, content: Option<String>) -> Result<FileData, String> {
    let file_path = Path::new(&path);
    
    if file_path.exists() {
        return Err("File already exists".to_string());
    }
    
    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }
    
    let file_content = content.unwrap_or_default();

    atomic_write_file(file_path, &file_content)?;
    
    let name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled")
        .to_string();
    
    Ok(FileData {
        path,
        content: file_content,
        name,
    })
}

/// Create a new folder
#[tauri::command]
pub async fn create_folder(path: String) -> Result<FileEntry, String> {
    let folder_path = Path::new(&path);
    
    if folder_path.exists() {
        return Err("Folder already exists".to_string());
    }
    
    fs::create_dir_all(folder_path)
        .map_err(|e| format!("Failed to create folder: {}", e))?;
    
    let name = folder_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("New Folder")
        .to_string();
    
    Ok(FileEntry {
        name,
        path,
        is_dir: true,
        is_markdown: false,
        children: Some(Vec::new()),
    })
}

/// Rename a file or folder
#[tauri::command]
pub async fn rename_item(old_path: String, new_name: String) -> Result<String, String> {
    let old = Path::new(&old_path);
    
    if !old.exists() {
        return Err("Item does not exist".to_string());
    }
    
    // Validate new name
    if new_name.is_empty() || new_name.contains('/') || new_name.contains('\\') {
        return Err("Invalid name".to_string());
    }
    
    let new_path = old.parent()
        .ok_or("Cannot get parent directory")?
        .join(&new_name);
    
    if new_path.exists() {
        return Err("An item with that name already exists".to_string());
    }
    
    fs::rename(old, &new_path)
        .map_err(|e| format!("Failed to rename: {}", e))?;
    
    new_path.to_str()
        .ok_or("Invalid path encoding".to_string())
        .map(|s| s.to_string())
}

/// Delete a file or folder
#[tauri::command]
pub async fn delete_item(path: String) -> Result<(), String> {
    let item_path = Path::new(&path);
    
    if !item_path.exists() {
        return Err("Item does not exist".to_string());
    }
    
    if item_path.is_dir() {
        fs::remove_dir_all(item_path)
            .map_err(|e| format!("Failed to delete folder: {}", e))?;
    } else {
        fs::remove_file(item_path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    
    Ok(())
}

/// Move a file or folder to a new location
#[tauri::command]
pub async fn move_item(source_path: String, target_dir: String) -> Result<String, String> {
    let source = Path::new(&source_path);
    let target_directory = Path::new(&target_dir);
    
    if !source.exists() {
        return Err("Source does not exist".to_string());
    }
    
    if !target_directory.is_dir() {
        return Err("Target is not a directory".to_string());
    }
    
    let file_name = source.file_name()
        .ok_or("Cannot get file name")?;
    
    let new_path = target_directory.join(file_name);
    
    if new_path.exists() {
        return Err("An item with that name already exists in the target location".to_string());
    }
    
    fs::rename(source, &new_path)
        .map_err(|e| format!("Failed to move: {}", e))?;
    
    new_path.to_str()
        .ok_or("Invalid path encoding".to_string())
        .map(|s| s.to_string())
}

/// Start watching a file for external changes.
#[tauri::command]
pub async fn start_file_watch(
    app: AppHandle,
    state: State<'_, FileWatchRegistry>,
    path: String,
) -> Result<(), String> {
    if path.is_empty() {
        return Err("Path is required".to_string());
    }

    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    let stop_flag = {
        let mut watchers = state
            .watchers
            .lock()
            .map_err(|_| "Failed to lock watcher registry")?;

        if watchers.contains_key(&path) {
            return Ok(());
        }

        let flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        watchers.insert(path.clone(), flag.clone());
        flag
    };

    let app_handle = app.clone();
    let watched_path = path.clone();

    thread::spawn(move || {
        let mut last_exists = Path::new(&watched_path).exists();
        let mut last_modified = if last_exists {
            read_modified_time(Path::new(&watched_path))
        } else {
            None
        };

        while !stop_flag.load(Ordering::Relaxed) {
            let current_path = Path::new(&watched_path);
            let exists = current_path.exists();

            if !exists {
                if last_exists {
                    let _ = app_handle.emit(
                        "file-watch-event",
                        FileWatchEvent {
                            path: watched_path.clone(),
                            kind: "removed".to_string(),
                        },
                    );
                }

                last_exists = false;
                last_modified = None;
                thread::sleep(Duration::from_millis(400));
                continue;
            }

            let modified = read_modified_time(current_path);
            if last_exists {
                if modified.is_some() && modified != last_modified {
                    let _ = app_handle.emit(
                        "file-watch-event",
                        FileWatchEvent {
                            path: watched_path.clone(),
                            kind: "modified".to_string(),
                        },
                    );
                }
            }

            last_exists = true;
            last_modified = modified;
            thread::sleep(Duration::from_millis(400));
        }
    });

    Ok(())
}

/// Stop watching a single file.
#[tauri::command]
pub async fn stop_file_watch(
    state: State<'_, FileWatchRegistry>,
    path: String,
) -> Result<(), String> {
    let removed = {
        let mut watchers = state
            .watchers
            .lock()
            .map_err(|_| "Failed to lock watcher registry")?;
        watchers.remove(&path)
    };

    if let Some(flag) = removed {
        flag.store(true, Ordering::Relaxed);
    }

    Ok(())
}

/// Stop watching all files.
#[tauri::command]
pub async fn stop_all_file_watches(
    state: State<'_, FileWatchRegistry>,
) -> Result<(), String> {
    let all_watchers = {
        let mut watchers = state
            .watchers
            .lock()
            .map_err(|_| "Failed to lock watcher registry")?;
        watchers.drain().map(|(_, flag)| flag).collect::<Vec<_>>()
    };

    for flag in all_watchers {
        flag.store(true, Ordering::Relaxed);
    }

    Ok(())
}
