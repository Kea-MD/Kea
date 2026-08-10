use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::sync::atomic::Ordering;
use std::thread;
use std::time::{Duration, Instant, SystemTime};
use tauri::{AppHandle, Emitter, State};
use crate::FileWatchRegistry;

const RECENT_WRITE_TTL: Duration = Duration::from_secs(2);

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

fn store_asset(document_path: &Path, file_name: &str, bytes: &[u8]) -> Result<String, String> {
    if !document_path.is_file() {
        return Err("Save the document before adding images".to_string());
    }
    let extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_lowercase)
        .ok_or("Image file needs an extension")?;
    if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg") {
        return Err("Unsupported image type".to_string());
    }
    let raw_stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let mut stem = raw_stem
        .chars()
        .map(|character| if character.is_alphanumeric() || matches!(character, '-' | '_') { character } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    if stem.is_empty() { stem = "image".to_string(); }

    let assets = document_path.parent().ok_or("Document has no parent directory")?.join("assets");
    fs::create_dir_all(&assets).map_err(|error| format!("Failed to create assets directory: {}", error))?;
    let mut candidate = assets.join(format!("{}.{}", stem, extension));
    let mut suffix = 2;
    while candidate.exists() {
        candidate = assets.join(format!("{}-{}.{}", stem, suffix, extension));
        suffix += 1;
    }
    fs::write(&candidate, bytes).map_err(|error| format!("Failed to write image: {}", error))?;
    Ok(format!("assets/{}", candidate.file_name().and_then(|value| value.to_str()).ok_or("Invalid asset name")?))
}

#[tauri::command]
pub async fn store_document_asset(document_path: String, file_name: String, bytes: Vec<u8>) -> Result<String, String> {
    store_asset(Path::new(&document_path), &file_name, &bytes)
}

fn read_modified_time(path: &Path) -> Option<SystemTime> {
    fs::metadata(path).ok()?.modified().ok()
}

fn content_signature(content: &[u8]) -> u64 {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    hasher.finish()
}

fn record_write(
    recent_writes: &Arc<Mutex<std::collections::HashMap<String, (Instant, u64)>>>,
    path: &str,
    content: &str,
) -> Result<(), String> {
    let now = Instant::now();
    let mut writes = recent_writes
        .lock()
        .map_err(|_| "Failed to lock recent-write registry")?;
    writes.retain(|_, (recorded_at, _)| now.duration_since(*recorded_at) < RECENT_WRITE_TTL);
    writes.insert(path.to_string(), (now, content_signature(content.as_bytes())));
    Ok(())
}

fn is_self_write(
    recent_writes: &Arc<Mutex<std::collections::HashMap<String, (Instant, u64)>>>,
    path: &str,
) -> bool {
    let expected_signature = {
        let now = Instant::now();
        let Ok(mut writes) = recent_writes.lock() else {
            return false;
        };
        writes.retain(|_, (recorded_at, _)| now.duration_since(*recorded_at) < RECENT_WRITE_TTL);
        writes.get(path).map(|(_, signature)| *signature)
    };

    let Some(expected_signature) = expected_signature else {
        return false;
    };
    let Ok(content) = fs::read(path) else {
        return false;
    };
    content_signature(&content) == expected_signature
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
pub async fn save_markdown_file(
    state: State<'_, FileWatchRegistry>,
    path: String,
    content: String,
) -> Result<(), String> {
    record_write(&state.recent_writes, &path, &content)?;
    atomic_write_file(Path::new(&path), &content)?;

    Ok(())
}

/// Save markdown content with file picker (Save As)
#[tauri::command]
pub async fn save_markdown_file_as(
    app: AppHandle,
    state: State<'_, FileWatchRegistry>,
    content: String,
) -> Result<SaveResult, String> {
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
            let path_str = path
                .to_str()
                .ok_or("Invalid file path")?
                .to_string();
            record_write(&state.recent_writes, &path_str, &content)?;
            atomic_write_file(&path, &content)?;

            // Get file name
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Untitled.md")
                .to_string();

            // Convert path to string
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

fn duplicate_destination(source: &Path) -> Result<PathBuf, String> {
    let parent = source.parent().ok_or("Cannot get parent directory")?;
    let stem = source
        .file_stem()
        .and_then(|name| name.to_str())
        .ok_or("Cannot get item name")?;
    let extension = source.extension().and_then(|value| value.to_str());

    for index in 1.. {
        let suffix = if index == 1 {
            " copy".to_string()
        } else {
            format!(" copy {}", index)
        };
        let name = match extension {
            Some(extension) => format!("{}{}.{}", stem, suffix, extension),
            None => format!("{}{}", stem, suffix),
        };
        let candidate = parent.join(name);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err("Could not choose a duplicate name".to_string())
}

fn copy_item(source: &Path, destination: &Path) -> Result<(), String> {
    if source.is_dir() {
        fs::create_dir(destination)
            .map_err(|e| format!("Failed to create duplicate folder: {}", e))?;
        for entry in fs::read_dir(source).map_err(|e| format!("Failed to read folder: {}", e))? {
            let entry = entry.map_err(|e| format!("Failed to read folder item: {}", e))?;
            copy_item(&entry.path(), &destination.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(source, destination)
            .map(|_| ())
            .map_err(|e| format!("Failed to duplicate file: {}", e))
    }
}

/// Duplicate a file or folder beside the original.
#[tauri::command]
pub async fn duplicate_item(path: String) -> Result<String, String> {
    let source = Path::new(&path);
    if !source.exists() {
        return Err("Item does not exist".to_string());
    }

    let destination = duplicate_destination(source)?;
    if let Err(error) = copy_item(source, &destination) {
        let _ = if destination.is_dir() {
            fs::remove_dir_all(&destination)
        } else {
            fs::remove_file(&destination)
        };
        return Err(error);
    }
    destination
        .to_str()
        .ok_or("Invalid path encoding".to_string())
        .map(|value| value.to_string())
}

/// Open a file or folder using the operating system default application.
#[tauri::command]
pub async fn open_item(path: String) -> Result<(), String> {
    tauri_plugin_opener::open_path(&path, None::<&str>)
        .map_err(|error| format!("Failed to open item: {}", error))
}

/// Reveal a file or folder in the operating system file manager.
#[tauri::command]
pub async fn reveal_item(path: String) -> Result<(), String> {
    tauri_plugin_opener::reveal_item_in_dir(&path)
        .map_err(|error| format!("Failed to reveal item: {}", error))
}

/// Reload the webview that invoked the in-app command menu.
#[tauri::command]
pub async fn reload_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window
        .reload()
        .map_err(|error| format!("Failed to reload window: {}", error))
}

/// Open developer tools from the in-app command menu.
#[tauri::command]
pub async fn open_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    window.open_devtools();
    Ok(())
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
    let recent_writes = state.recent_writes.clone();

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
                    // A missing file cannot match a completed Kea write. Always
                    // surface removals so genuine external deletes are immediate.
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
                    if !is_self_write(&recent_writes, &watched_path) {
                        let _ = app_handle.emit(
                            "file-watch-event",
                            FileWatchEvent {
                                path: watched_path.clone(),
                                kind: "modified".to_string(),
                            },
                        );
                    }
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

#[cfg(test)]
mod tests {
    use super::{atomic_write_file, copy_item, duplicate_destination, is_markdown_file, is_self_write, read_dir_entries, record_write, store_asset};
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_temp_dir(test_name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();

        let dir = std::env::temp_dir().join(format!("kea-tests-{}-{}", test_name, unique));
        fs::create_dir_all(&dir).expect("failed to create temporary test directory");
        dir
    }

    #[test]
    fn atomic_write_file_creates_parents_and_replaces_existing_content() {
        let root = make_temp_dir("atomic-write");
        let file_path = root.join("nested").join("note.md");

        atomic_write_file(&file_path, "first").expect("first write should succeed");
        let first = fs::read_to_string(&file_path).expect("file should be readable after first write");
        assert_eq!(first, "first");

        atomic_write_file(&file_path, "second").expect("second write should succeed");
        let second = fs::read_to_string(&file_path).expect("file should be readable after second write");
        assert_eq!(second, "second");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn recent_write_suppression_only_matches_the_content_kea_saved() {
        let root = make_temp_dir("recent-write");
        let file_path = root.join("note.md");
        let path = file_path.to_string_lossy().to_string();
        let recent_writes = Arc::new(Mutex::new(HashMap::new()));

        record_write(&recent_writes, &path, "kea content").expect("write should be recorded");
        fs::write(&file_path, "kea content").expect("saved content should be written");
        assert!(is_self_write(&recent_writes, &path));

        fs::write(&file_path, "external content").expect("external content should be written");
        assert!(!is_self_write(&recent_writes, &path));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn markdown_extension_detection_matches_supported_variants() {
        assert!(is_markdown_file(PathBuf::from("note.md").as_path()));
        assert!(is_markdown_file(PathBuf::from("note.markdown").as_path()));
        assert!(is_markdown_file(PathBuf::from("note.mdown").as_path()));
        assert!(is_markdown_file(PathBuf::from("note.mkd").as_path()));
        assert!(!is_markdown_file(PathBuf::from("note.txt").as_path()));
        assert!(!is_markdown_file(PathBuf::from("note").as_path()));
    }

    #[test]
    fn read_dir_entries_skips_hidden_items_and_sorts_directories_first() {
        let root = make_temp_dir("read-dir-sort");
        fs::create_dir_all(root.join("b-folder")).expect("failed to create b-folder");
        fs::create_dir_all(root.join("a-folder")).expect("failed to create a-folder");
        fs::write(root.join("z.md"), "# markdown").expect("failed to write markdown file");
        fs::write(root.join("a.txt"), "plain").expect("failed to write text file");
        fs::write(root.join(".hidden.md"), "hidden").expect("failed to write hidden file");

        let entries = read_dir_entries(&root, 0, 1).expect("read_dir_entries should succeed");
        let names: Vec<&str> = entries.iter().map(|entry| entry.name.as_str()).collect();

        assert_eq!(names, vec!["a-folder", "b-folder", "a.txt", "z.md"]);
        assert!(entries.iter().all(|entry| !entry.name.starts_with('.')));

        let markdown_entry = entries.iter().find(|entry| entry.name == "z.md").expect("z.md should exist");
        assert!(markdown_entry.is_markdown);

        let text_entry = entries.iter().find(|entry| entry.name == "a.txt").expect("a.txt should exist");
        assert!(!text_entry.is_markdown);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn read_dir_entries_uses_empty_children_at_max_depth_for_directories() {
        let root = make_temp_dir("read-dir-depth");
        fs::create_dir_all(root.join("folder")).expect("failed to create folder");
        fs::write(root.join("folder").join("child.md"), "child").expect("failed to write child file");

        let entries = read_dir_entries(&root, 0, 0).expect("read_dir_entries should succeed");
        let folder = entries.iter().find(|entry| entry.name == "folder").expect("folder should exist");

        assert!(folder.is_dir);
        assert_eq!(folder.children.as_ref().map(|children| children.len()), Some(0));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn document_assets_are_sanitised_and_never_overwritten() {
        let root = make_temp_dir("assets");
        let document = root.join("note.md");
        fs::write(&document, "# note").expect("failed to create document");
        let first = store_asset(&document, "My screenshot!.PNG", &[1, 2, 3]).expect("first asset should save");
        let second = store_asset(&document, "My screenshot!.PNG", &[4, 5]).expect("second asset should save");
        assert_eq!(first, "assets/My-screenshot.png");
        assert_eq!(second, "assets/My-screenshot-2.png");
        assert_eq!(fs::read(root.join(&first)).expect("asset should be readable"), vec![1, 2, 3]);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn duplicate_helpers_choose_a_unique_name_and_copy_contents() {
        let root = make_temp_dir("duplicate");
        let source = root.join("note.md");
        fs::write(&source, "# note").expect("failed to create source file");
        fs::write(root.join("note copy.md"), "existing").expect("failed to create first duplicate");

        let destination = duplicate_destination(&source).expect("duplicate destination should be available");
        assert_eq!(destination.file_name().and_then(|name| name.to_str()), Some("note copy 2.md"));
        copy_item(&source, &destination).expect("duplicate should copy successfully");
        assert_eq!(fs::read_to_string(destination).expect("duplicate should be readable"), "# note");

        let _ = fs::remove_dir_all(root);
    }
}
