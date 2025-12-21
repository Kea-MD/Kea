import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'

export interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  is_markdown: boolean
  children?: FileEntry[]
}

interface WorkspaceState {
  rootPath: string | null
  rootName: string | null
  entries: FileEntry[]
  expandedFolders: Set<string>
  isLoading: boolean
}

export const useWorkspaceStore = defineStore('workspace', {
  state: (): WorkspaceState => ({
    rootPath: null,
    rootName: null,
    entries: [],
    expandedFolders: new Set<string>(),
    isLoading: false,
  }),

  getters: {
    hasWorkspace: (state): boolean => state.rootPath !== null,
    
    allMarkdownFiles: (state): FileEntry[] => {
      const files: FileEntry[] = []
      const collectFiles = (entries: FileEntry[]) => {
        for (const entry of entries) {
          if (entry.is_markdown) {
            files.push(entry)
          }
          if (entry.children) {
            collectFiles(entry.children)
          }
        }
      }
      collectFiles(state.entries)
      return files
    },
  },

  actions: {
    async openFolder(): Promise<boolean> {
      try {
        this.isLoading = true
        
        const result = await invoke<{
          path: string
          name: string
          entries: FileEntry[]
        }>('open_folder_dialog')
        
        this.rootPath = result.path
        this.rootName = result.name
        this.entries = result.entries
        this.expandedFolders.clear()
        
        // Persist workspace path
        this.saveWorkspacePath()
        
        return true
      } catch (error) {
        if (error !== 'No folder selected') {
          console.error('Failed to open folder:', error)
        }
        return false
      } finally {
        this.isLoading = false
      }
    },

    async loadDirectory(path: string): Promise<FileEntry[]> {
      try {
        const entries = await invoke<FileEntry[]>('read_directory', { path })
        return entries
      } catch (error) {
        console.error('Failed to load directory:', error)
        return []
      }
    },

    async expandFolder(path: string): Promise<void> {
      if (this.expandedFolders.has(path)) return
      
      // Find the folder entry and load its children if needed
      const folder = this.findEntry(path)
      if (folder && folder.is_dir) {
        if (!folder.children || folder.children.length === 0) {
          folder.children = await this.loadDirectory(path)
        }
        this.expandedFolders.add(path)
      }
    },

    collapseFolder(path: string): void {
      this.expandedFolders.delete(path)
    },

    toggleFolder(path: string): void {
      if (this.expandedFolders.has(path)) {
        this.collapseFolder(path)
      } else {
        this.expandFolder(path)
      }
    },

    isExpanded(path: string): boolean {
      return this.expandedFolders.has(path)
    },

    findEntry(path: string, entries?: FileEntry[]): FileEntry | null {
      const searchEntries = entries ?? this.entries
      for (const entry of searchEntries) {
        if (entry.path === path) return entry
        if (entry.children) {
          const found = this.findEntry(path, entry.children)
          if (found) return found
        }
      }
      return null
    },

    async createFile(parentPath: string, name: string): Promise<FileEntry | null> {
      try {
        const filePath = `${parentPath}/${name}`
        const result = await invoke<{ path: string; content: string; name: string }>('create_file', {
          path: filePath,
          content: '',
        })
        
        // Add to entries
        const parent = this.findEntry(parentPath)
        if (parent && parent.children) {
          const newEntry: FileEntry = {
            name: result.name,
            path: result.path,
            is_dir: false,
            is_markdown: name.endsWith('.md'),
          }
          parent.children.push(newEntry)
          this.sortEntries(parent.children)
          return newEntry
        }
        
        return null
      } catch (error) {
        console.error('Failed to create file:', error)
        throw error
      }
    },

    async createFolder(parentPath: string, name: string): Promise<FileEntry | null> {
      try {
        const folderPath = `${parentPath}/${name}`
        const result = await invoke<FileEntry>('create_folder', { path: folderPath })
        
        // Add to entries
        const parent = this.findEntry(parentPath)
        if (parent && parent.children) {
          parent.children.push(result)
          this.sortEntries(parent.children)
          return result
        }
        
        return null
      } catch (error) {
        console.error('Failed to create folder:', error)
        throw error
      }
    },

    async renameItem(path: string, newName: string): Promise<string | null> {
      try {
        const newPath = await invoke<string>('rename_item', { oldPath: path, newName })
        
        // Update entry in tree
        const entry = this.findEntry(path)
        if (entry) {
          entry.name = newName
          entry.path = newPath
          entry.is_markdown = !entry.is_dir && newName.endsWith('.md')
        }
        
        return newPath
      } catch (error) {
        console.error('Failed to rename:', error)
        throw error
      }
    },

    async deleteItem(path: string): Promise<boolean> {
      try {
        await invoke('delete_item', { path })
        
        // Remove from entries
        this.removeEntry(path)
        
        return true
      } catch (error) {
        console.error('Failed to delete:', error)
        throw error
      }
    },

    removeEntry(path: string, entries?: FileEntry[]): boolean {
      const searchEntries = entries ?? this.entries
      const index = searchEntries.findIndex(e => e.path === path)
      if (index !== -1) {
        searchEntries.splice(index, 1)
        return true
      }
      
      for (const entry of searchEntries) {
        if (entry.children && this.removeEntry(path, entry.children)) {
          return true
        }
      }
      
      return false
    },

    sortEntries(entries: FileEntry[]): void {
      entries.sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1
        if (!a.is_dir && b.is_dir) return 1
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      })
    },

    async refreshDirectory(path: string): Promise<void> {
      const entries = await this.loadDirectory(path)
      
      if (path === this.rootPath) {
        this.entries = entries
      } else {
        const entry = this.findEntry(path)
        if (entry) {
          entry.children = entries
        }
      }
    },

    saveWorkspacePath(): void {
      if (this.rootPath) {
        localStorage.setItem('orca-workspace-path', this.rootPath)
      } else {
        localStorage.removeItem('orca-workspace-path')
      }
    },

    loadWorkspacePath(): string | null {
      return localStorage.getItem('orca-workspace-path')
    },

    async restoreWorkspace(): Promise<boolean> {
      const savedPath = this.loadWorkspacePath()
      if (!savedPath) return false
      
      try {
        this.isLoading = true
        const entries = await this.loadDirectory(savedPath)
        
        this.rootPath = savedPath
        this.rootName = savedPath.split('/').pop() || 'Workspace'
        this.entries = entries
        
        return true
      } catch (error) {
        console.error('Failed to restore workspace:', error)
        localStorage.removeItem('orca-workspace-path')
        return false
      } finally {
        this.isLoading = false
      }
    },

    closeWorkspace(): void {
      this.rootPath = null
      this.rootName = null
      this.entries = []
      this.expandedFolders.clear()
      localStorage.removeItem('orca-workspace-path')
    },
  },
})
