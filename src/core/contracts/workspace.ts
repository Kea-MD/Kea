export interface WorkspaceFileEntry {
  name: string
  path: string
  is_dir: boolean
  is_markdown: boolean
  children?: WorkspaceFileEntry[]
}

export interface OpenedFolderData {
  path: string
  name: string
  entries: WorkspaceFileEntry[]
}

export interface CreatedFileData {
  path: string
  content: string
  name: string
}

export interface WorkspacePort {
  openFolderDialog: () => Promise<OpenedFolderData>
  readDirectory: (path: string) => Promise<WorkspaceFileEntry[]>
  createFile: (path: string, content: string) => Promise<CreatedFileData>
  createFolder: (path: string) => Promise<WorkspaceFileEntry>
  renameItem: (oldPath: string, newName: string) => Promise<string>
  deleteItem: (path: string) => Promise<void>
  moveItem: (sourcePath: string, targetDir: string) => Promise<string>
}
