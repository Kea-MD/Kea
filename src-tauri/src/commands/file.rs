use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::AppHandle;

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
    fs::write(&path, content)
        .map_err(|e| format!("Failed to save file: {}", e))?;

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
            fs::write(&path, content)
                .map_err(|e| format!("Failed to save file: {}", e))?;

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
    
    fs::write(file_path, &file_content)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
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