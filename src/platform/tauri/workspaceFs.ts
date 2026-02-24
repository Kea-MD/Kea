import { invoke } from '@tauri-apps/api/core'
import type {
  CreatedFileData,
  OpenedFolderData,
  WorkspaceFileEntry,
  WorkspacePort,
} from './workspaceFs.types'

export const tauriWorkspacePort: WorkspacePort = {
  openFolderDialog(): Promise<OpenedFolderData> {
    return invoke<OpenedFolderData>('open_folder_dialog')
  },

  readDirectory(path: string): Promise<WorkspaceFileEntry[]> {
    return invoke<WorkspaceFileEntry[]>('read_directory', { path })
  },

  createFile(path: string, content: string): Promise<CreatedFileData> {
    return invoke<CreatedFileData>('create_file', {
      path,
      content,
    })
  },

  createFolder(path: string): Promise<WorkspaceFileEntry> {
    return invoke<WorkspaceFileEntry>('create_folder', { path })
  },

  renameItem(oldPath: string, newName: string): Promise<string> {
    return invoke<string>('rename_item', {
      oldPath,
      newName,
    })
  },

  deleteItem(path: string): Promise<void> {
    return invoke('delete_item', { path })
  },

  moveItem(sourcePath: string, targetDir: string): Promise<string> {
    return invoke<string>('move_item', {
      sourcePath,
      targetDir,
    })
  },
}
