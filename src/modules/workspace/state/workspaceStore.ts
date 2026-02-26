import { defineStore } from 'pinia'
import { tauriWorkspacePort } from '../../../platform/tauri/workspaceFs'

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

const workspacePort = tauriWorkspacePort

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

        const result = await workspacePort.openFolderDialog()
        
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

    async loadDirectory(path: string, throwOnError = false): Promise<FileEntry[]> {
      try {
        const entries = await workspacePort.readDirectory(path)
        return entries
      } catch (error) {
        console.error('Failed to load directory:', error)

        if (throwOnError) {
          throw error
        }

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

    findParentCollection(path: string, entries?: FileEntry[]): FileEntry[] | null {
      const searchEntries = entries ?? this.entries
      for (const entry of searchEntries) {
        if (entry.path === path) {
          return searchEntries
        }

        if (entry.children) {
          const parent = this.findParentCollection(path, entry.children)
          if (parent) return parent
        }
      }

      return null
    },

    buildChildPath(parentPath: string, name: string): string {
      const separator = parentPath.includes('\\') && !parentPath.includes('/') ? '\\' : '/'
      return `${parentPath.replace(/[\\/]+$/, '')}${separator}${name}`
    },

    getParentPath(path: string): string | null {
      const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
      if (separatorIndex <= 0) {
        return null
      }

      return path.slice(0, separatorIndex)
    },

    getPathName(path: string): string {
      const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
      return separatorIndex >= 0 ? path.slice(separatorIndex + 1) : path
    },

    pathMatches(path: string, prefix: string): boolean {
      return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}\\`)
    },

    replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
      if (path === oldPrefix) {
        return newPrefix
      }

      if (!this.pathMatches(path, oldPrefix)) {
        return path
      }

      return `${newPrefix}${path.slice(oldPrefix.length)}`
    },

    updateDescendantPaths(entry: FileEntry, oldPrefix: string, newPrefix: string): void {
      if (!entry.children?.length) return

      for (const child of entry.children) {
        child.path = this.replacePathPrefix(child.path, oldPrefix, newPrefix)

        if (child.children?.length) {
          this.updateDescendantPaths(child, oldPrefix, newPrefix)
        }
      }
    },

    updateExpandedFoldersForRename(oldPath: string, newPath: string): void {
      const updatedExpanded = new Set<string>()

      for (const expandedPath of this.expandedFolders) {
        updatedExpanded.add(this.replacePathPrefix(expandedPath, oldPath, newPath))
      }

      this.expandedFolders = updatedExpanded
    },

    async createFile(parentPath: string, name: string): Promise<FileEntry | null> {
      try {
        const filePath = this.buildChildPath(parentPath, name)
        const result = await workspacePort.createFile(filePath, '')
        
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
        const folderPath = this.buildChildPath(parentPath, name)
        const result = await workspacePort.createFolder(folderPath)
        
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
        const newPath = await workspacePort.renameItem(path, newName)
        const parentCollection = this.findParentCollection(path)

        // Update entry in tree
        const entry = this.findEntry(path)
        if (entry) {
          entry.name = newName
          entry.path = newPath
          entry.is_markdown = !entry.is_dir && newName.endsWith('.md')

          if (entry.is_dir) {
            this.updateDescendantPaths(entry, path, newPath)
          }
        }

        this.updateExpandedFoldersForRename(path, newPath)

        if (parentCollection) {
          this.sortEntries(parentCollection)
        }

        if (this.rootPath === path) {
          this.rootPath = newPath
          this.rootName = newName
          this.saveWorkspacePath()
        }

        return newPath
      } catch (error) {
        console.error('Failed to rename:', error)
        throw error
      }
    },

    async deleteItem(path: string): Promise<boolean> {
      try {
        await workspacePort.deleteItem(path)
        
        // Remove from entries
        this.removeEntry(path)

        for (const expandedPath of Array.from(this.expandedFolders)) {
          if (this.pathMatches(expandedPath, path)) {
            this.expandedFolders.delete(expandedPath)
          }
        }
        
        return true
      } catch (error) {
        console.error('Failed to delete:', error)
        throw error
      }
    },

    async moveItem(sourcePath: string, targetDir: string): Promise<string | null> {
      console.log('[Sidebar DnD][Store] moveItem called', {
        sourcePath,
        targetDir,
        rootPath: this.rootPath,
      })

      const sourceEntry = this.findEntry(sourcePath)
      if (!sourceEntry || !this.rootPath) {
        console.log('[Sidebar DnD][Store] moveItem rejected: source entry/root missing', {
          sourcePath,
          targetDir,
          hasSourceEntry: Boolean(sourceEntry),
          rootPath: this.rootPath,
        })
        return null
      }

      if (sourcePath === this.rootPath || sourcePath === targetDir) {
        console.log('[Sidebar DnD][Store] moveItem rejected: source is root or source equals target', {
          sourcePath,
          targetDir,
          rootPath: this.rootPath,
        })
        return null
      }

      const sourceParentPath = this.getParentPath(sourcePath)
      if (sourceParentPath === targetDir) {
        console.log('[Sidebar DnD][Store] moveItem rejected: source already in target directory', {
          sourcePath,
          sourceParentPath,
          targetDir,
        })
        return null
      }

      if (sourceEntry.is_dir && this.pathMatches(targetDir, sourcePath)) {
        console.log('[Sidebar DnD][Store] moveItem rejected: folder into itself/descendant', {
          sourcePath,
          targetDir,
        })
        return null
      }

      try {
        const sourceCollection = this.findParentCollection(sourcePath)
        if (!sourceCollection) {
          console.log('[Sidebar DnD][Store] moveItem rejected: source parent collection missing', {
            sourcePath,
            targetDir,
          })
          return null
        }

        const sourceIndex = sourceCollection.findIndex(entry => entry.path === sourcePath)
        if (sourceIndex === -1) {
          console.log('[Sidebar DnD][Store] moveItem rejected: source index not found', {
            sourcePath,
            targetDir,
          })
          return null
        }

        const targetCollection = targetDir === this.rootPath
          ? this.entries
          : (() => {
              const targetEntry = this.findEntry(targetDir)
              if (!targetEntry || !targetEntry.is_dir) {
                return null
              }

              if (!targetEntry.children) {
                targetEntry.children = []
              }

              return targetEntry.children
            })()

        if (!targetCollection) {
          console.log('[Sidebar DnD][Store] moveItem rejected: target collection missing', {
            sourcePath,
            targetDir,
          })
          return null
        }

        const newPath = await workspacePort.moveItem(sourcePath, targetDir)
        const [movedEntry] = sourceCollection.splice(sourceIndex, 1)

        movedEntry.path = newPath
        movedEntry.name = this.getPathName(newPath)
        movedEntry.is_markdown = !movedEntry.is_dir && movedEntry.name.endsWith('.md')

        if (movedEntry.is_dir) {
          this.updateDescendantPaths(movedEntry, sourcePath, newPath)
        }

        targetCollection.push(movedEntry)
        this.sortEntries(targetCollection)

        if (sourceCollection !== targetCollection) {
          this.sortEntries(sourceCollection)
        }

        this.updateExpandedFoldersForRename(sourcePath, newPath)

        console.log('[Sidebar DnD][Store] moveItem success', {
          sourcePath,
          targetDir,
          newPath,
          movedName: movedEntry.name,
        })

        return newPath
      } catch (error) {
        console.error('Failed to move item:', error)
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
        localStorage.setItem('kea-workspace-path', this.rootPath)
      } else {
        localStorage.removeItem('kea-workspace-path')
      }
    },

    loadWorkspacePath(): string | null {
      return localStorage.getItem('kea-workspace-path')
    },

    async restoreWorkspace(): Promise<boolean> {
      const savedPath = this.loadWorkspacePath()
      if (!savedPath) return false
      
      try {
        this.isLoading = true
        const entries = await this.loadDirectory(savedPath, true)
        
        this.rootPath = savedPath
        this.rootName = savedPath.split('/').pop() || 'Workspace'
        this.entries = entries
        
        return true
      } catch (error) {
        console.error('Failed to restore workspace:', error)
        localStorage.removeItem('kea-workspace-path')
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
      localStorage.removeItem('kea-workspace-path')
    },
  },
})
