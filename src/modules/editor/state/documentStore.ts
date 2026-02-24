import { defineStore } from 'pinia'
import { tauriDocumentStoragePort } from '../../../platform/tauri/documentStorage'
import type { DocumentCommand } from './documentCommands'
import { dispatchDocumentCommand } from './dispatchDocumentCommand'
import type { EditorMode } from '../editorCommands'

export interface OpenDocument {
  id: string
  path: string
  name: string
  content: string
  savedContent: string
  isDirty: boolean
}

interface RecentFile {
  path: string
  name: string
  lastOpened: number
}

interface ExternalChangeAlert {
  documentId: string
  path: string
  diskContent: string
  detectedAt: number
}

function runDocumentCommand<TResult>(command: DocumentCommand, apply: () => TResult): TResult {
  return dispatchDocumentCommand({
    command,
    apply,
  })
}

const documentStoragePort = tauriDocumentStoragePort

export const useDocumentStore = defineStore('document', {
  state: () => ({
    openDocuments: [] as OpenDocument[],
    activeDocumentId: null as string | null,
    recentFiles: [] as RecentFile[],
    editorMode: 'source' as EditorMode,
    externalChange: null as ExternalChangeAlert | null,
    ignoredExternalChanges: {} as Record<string, string>,
    isSaving: false,
    isLoading: false,
    lastSaveTime: null as number | null,
  }),

  getters: {
    activeDocument: (state): OpenDocument | null => {
      if (!state.activeDocumentId) return null
      return state.openDocuments.find(d => d.id === state.activeDocumentId) || null
    },

    hasUnsavedChanges(): boolean {
      return this.activeDocument?.isDirty || false
    },

    hasAnyUnsavedChanges: (state): boolean => {
      return state.openDocuments.some(d => d.isDirty)
    },

    currentFileName(): string {
      return this.activeDocument?.name || 'Untitled'
    },

    currentFilePath(): string | null {
      return this.activeDocument?.path || null
    },

    // For backwards compatibility
    currentFile(): OpenDocument | null {
      return this.activeDocument
    },

    openTabs: (state): OpenDocument[] => {
      return state.openDocuments
    },

    hasExternalChange: (state): boolean => state.externalChange !== null,

    isSourceMode: (state): boolean => state.editorMode === 'source',

    isRenderedMode: (state): boolean => state.editorMode === 'rendered',

    // Backwards compatibility for older references
    isHybridMode(): boolean {
      return this.isRenderedMode
    },
  },

  actions: {
    /**
     * Generate a unique ID for documents
     */
    generateId(): string {
      return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    },

    /**
     * Find document by path
     */
    findDocumentByPath(path: string): OpenDocument | undefined {
      return this.openDocuments.find(d => d.path === path)
    },

    /**
     * Open a file and load its content (supports multiple tabs)
     */
    async openFile(path: string, content: string, name: string): Promise<string> {
      // Check if already open
      const existing = this.findDocumentByPath(path)
      if (existing) {
        this.activeDocumentId = existing.id
        this.externalChange = null
        return existing.id
      }

      const id = this.generateId()
      const doc: OpenDocument = {
        id,
        path,
        name,
        content,
        savedContent: content,
        isDirty: false,
      }

      return runDocumentCommand(
        {
          type: 'openDocument',
          source: 'local',
          documentId: id,
          path,
          contentLength: content.length,
        },
        () => {
          this.openDocuments.push(doc)
          this.activeDocumentId = id
          this.externalChange = null
          this.addToRecentFiles(path, name)
          this.lastSaveTime = Date.now()

          return id
        }
      )
    },

    /**
     * Open a file from path (reads from disk)
     */
    async openFileFromPath(path: string): Promise<string | null> {
      // Check if already open
      const existing = this.findDocumentByPath(path)
      if (existing) {
        this.activeDocumentId = existing.id
        return existing.id
      }

      try {
        this.isLoading = true
        const result = await documentStoragePort.readFile(path)
        return await this.openFile(result.path, result.content, result.name)
      } catch (error) {
        console.error('Failed to open file:', error)
        throw error
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Switch to a different open document
     */
    setActiveDocument(id: string): void {
      const doc = this.openDocuments.find(d => d.id === id)
      if (doc) {
        runDocumentCommand(
          {
            type: 'switchDocument',
            source: 'local',
            documentId: id,
            path: doc.path,
          },
          () => {
            this.activeDocumentId = id

            if (this.externalChange?.documentId !== id) {
              this.externalChange = null
            }
          }
        )
      }
    },

    setEditorMode(mode: EditorMode): void {
      this.editorMode = mode
    },

    toggleEditorMode(): void {
      this.editorMode = this.editorMode === 'source' ? 'rendered' : 'source'
    },

    /**
     * Close a document tab
     */
    async closeDocument(id: string, force = false): Promise<boolean> {
      const doc = this.openDocuments.find(d => d.id === id)
      if (!doc) return false

      // Check for unsaved changes
      if (doc.isDirty && !force) {
        const confirmed = confirm(`"${doc.name}" has unsaved changes. Do you want to discard them?`)
        if (!confirmed) return false
      }

      const index = this.openDocuments.findIndex(d => d.id === id)

      return runDocumentCommand(
        {
          type: 'closeDocument',
          source: 'local',
          documentId: id,
          path: doc.path,
        },
        () => {
          this.openDocuments.splice(index, 1)

          // Update active document if needed
          if (this.activeDocumentId === id) {
            if (this.openDocuments.length > 0) {
              // Switch to adjacent tab
              const newIndex = Math.min(index, this.openDocuments.length - 1)
              this.activeDocumentId = this.openDocuments[newIndex].id
            } else {
              this.activeDocumentId = null
            }
          }

          if (this.externalChange?.documentId === id) {
            this.externalChange = null
          }

          if (doc.path) {
            delete this.ignoredExternalChanges[doc.path]
          }

          return true
        }
      )
    },

    /**
     * Close all documents
     */
    async closeAllDocuments(force = false): Promise<boolean> {
      if (!force && this.hasAnyUnsavedChanges) {
        const confirmed = confirm('You have unsaved changes. Do you want to discard them?')
        if (!confirmed) return false
      }

      return runDocumentCommand(
        {
          type: 'closeAllDocuments',
          source: 'local',
        },
        () => {
          this.openDocuments = []
          this.activeDocumentId = null
          this.externalChange = null
          this.ignoredExternalChanges = {}
          return true
        }
      )
    },

    /**
     * Update the current file content (called when editor changes)
     */
    updateContent(newContent: string): void {
      const doc = this.activeDocument
      if (!doc) return

      runDocumentCommand(
        {
          type: 'updateContent',
          source: 'local',
          documentId: doc.id,
          path: doc.path,
          contentLength: newContent.length,
        },
        () => {
          doc.content = newContent
          doc.isDirty = newContent !== doc.savedContent
        }
      )
    },

    /**
     * Update content for a specific document
     */
    updateDocumentContent(id: string, newContent: string): void {
      const doc = this.openDocuments.find(d => d.id === id)
      if (!doc) return

      runDocumentCommand(
        {
          type: 'updateContent',
          source: 'local',
          documentId: doc.id,
          path: doc.path,
          contentLength: newContent.length,
        },
        () => {
          doc.content = newContent
          doc.isDirty = newContent !== doc.savedContent
        }
      )
    },

    /**
     * Save the current file to disk
     */
    async saveFile(): Promise<boolean> {
      const doc = this.activeDocument
      if (!doc || this.isSaving) return false

      // If no path, do Save As
      if (!doc.path) {
        return this.saveFileAs()
      }

      try {
        this.isSaving = true

        await documentStoragePort.saveMarkdownFile(doc.path, doc.content)

        return runDocumentCommand(
          {
            type: 'saveDocument',
            source: 'local',
            documentId: doc.id,
            path: doc.path,
            contentLength: doc.content.length,
          },
          () => {
            doc.savedContent = doc.content
            doc.isDirty = false
            this.externalChange = null
            delete this.ignoredExternalChanges[doc.path]
            this.lastSaveTime = Date.now()

            return true
          }
        )
      } catch (error) {
        console.error('Failed to save file:', error)
        throw error
      } finally {
        this.isSaving = false
      }
    },

    /**
     * Save all open documents
     */
    async saveAllFiles(): Promise<boolean> {
      const unsaved = this.openDocuments.filter(d => d.isDirty && d.path)
      
      for (const doc of unsaved) {
        try {
          await documentStoragePort.saveMarkdownFile(doc.path, doc.content)

          runDocumentCommand(
            {
              type: 'saveDocument',
              source: 'local',
              documentId: doc.id,
              path: doc.path,
              contentLength: doc.content.length,
            },
            () => {
              doc.savedContent = doc.content
              doc.isDirty = false

              if (this.externalChange?.documentId === doc.id) {
                this.externalChange = null
              }

              delete this.ignoredExternalChanges[doc.path]
            }
          )
        } catch (error) {
          console.error(`Failed to save ${doc.name}:`, error)
          return false
        }
      }
      
      this.lastSaveTime = Date.now()
      return true
    },

    /**
     * Save file with a new path (Save As)
     */
    async saveFileAs(): Promise<boolean> {
      const doc = this.activeDocument
      if (!doc || this.isSaving) return false

      try {
        this.isSaving = true

        const result = await documentStoragePort.saveMarkdownFileAs(doc.content)

        return runDocumentCommand(
          {
            type: 'saveDocumentAs',
            source: 'local',
            documentId: doc.id,
            path: result.path,
            contentLength: doc.content.length,
          },
          () => {
            doc.path = result.path
            doc.name = result.name
            doc.savedContent = doc.content
            doc.isDirty = false
            this.externalChange = null
            delete this.ignoredExternalChanges[result.path]
            this.lastSaveTime = Date.now()

            this.addToRecentFiles(result.path, result.name)

            return true
          }
        )
      } catch (error) {
        console.error('Failed to save file as:', error)
        throw error
      } finally {
        this.isSaving = false
      }
    },

    /**
     * Open file picker and load selected file
     */
    async openFileDialog(): Promise<boolean> {
      try {
        this.isLoading = true

        const result = await documentStoragePort.openMarkdownFile()

        await this.openFile(result.path, result.content, result.name)

        return true
      } catch (error) {
        if (error !== 'No file selected') {
          console.error('Failed to open file:', error)
        }
        return false
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Create a new empty file tab
     */
    newFile(): string {
      const id = this.generateId()
      const doc: OpenDocument = {
        id,
        path: '',
        name: 'Untitled',
        content: '',
        savedContent: '',
        isDirty: false,
      }

      return runDocumentCommand(
        {
          type: 'createDocument',
          source: 'local',
          documentId: id,
          contentLength: 0,
        },
        () => {
          this.openDocuments.push(doc)
          this.activeDocumentId = id
          this.externalChange = null

          return id
        }
      )
    },

    async checkActiveDocumentExternalChange(): Promise<void> {
      const doc = this.activeDocument
      if (!doc || !doc.path || this.isSaving || this.isLoading) return

      try {
        const result = await documentStoragePort.readFile(doc.path)
        const diskContent = result.content

        if (diskContent === doc.savedContent) {
          if (this.externalChange?.documentId === doc.id) {
            this.externalChange = null
          }
          delete this.ignoredExternalChanges[doc.path]
          return
        }

        if (!doc.isDirty) {
          runDocumentCommand(
            {
              type: 'applyExternalEdit',
              source: 'external',
              documentId: doc.id,
              path: doc.path,
              contentLength: diskContent.length,
            },
            () => {
              doc.content = diskContent
              doc.savedContent = diskContent
              doc.isDirty = false
              this.externalChange = null
              delete this.ignoredExternalChanges[doc.path]
            }
          )

          return
        }

        if (this.ignoredExternalChanges[doc.path] === diskContent) {
          return
        }

        this.externalChange = {
          documentId: doc.id,
          path: doc.path,
          diskContent,
          detectedAt: Date.now(),
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('does not exist')) {
          return
        }

        console.error('Failed to check external file changes:', error)
      }
    },

    acceptExternalChange(): boolean {
      const change = this.externalChange
      if (!change) return false

      const doc = this.openDocuments.find(d => d.id === change.documentId)
      if (!doc) {
        this.externalChange = null
        return false
      }

      runDocumentCommand(
        {
          type: 'applyExternalEdit',
          source: 'external',
          documentId: doc.id,
          path: doc.path,
          contentLength: change.diskContent.length,
        },
        () => {
          doc.content = change.diskContent
          doc.savedContent = change.diskContent
          doc.isDirty = false
          this.externalChange = null
          delete this.ignoredExternalChanges[doc.path]
        }
      )

      return true
    },

    keepLocalVersion(): boolean {
      const change = this.externalChange
      if (!change) return false

      this.ignoredExternalChanges[change.path] = change.diskContent
      this.externalChange = null
      return true
    },

    pathMatchesRename(path: string, oldPath: string, isDirectory: boolean): boolean {
      if (path === oldPath) return true
      if (!isDirectory) return false
      return path.startsWith(`${oldPath}/`) || path.startsWith(`${oldPath}\\`)
    },

    replacePathPrefix(path: string, oldPath: string, newPath: string): string {
      if (path === oldPath) return newPath
      return `${newPath}${path.slice(oldPath.length)}`
    },

    updatePathsAfterRename(oldPath: string, newPath: string, isDirectory: boolean): void {
      const affectedDocuments = this.openDocuments.filter(doc =>
        this.pathMatchesRename(doc.path, oldPath, isDirectory)
      )

      affectedDocuments.forEach(doc => {
        doc.path = this.replacePathPrefix(doc.path, oldPath, newPath)
        const updatedName = doc.path.split(/[\\/]/).pop()
        if (updatedName) {
          doc.name = updatedName
        }
      })

      if (this.externalChange && this.pathMatchesRename(this.externalChange.path, oldPath, isDirectory)) {
        this.externalChange.path = this.replacePathPrefix(this.externalChange.path, oldPath, newPath)
      }

      const updatedIgnored: Record<string, string> = {}
      Object.entries(this.ignoredExternalChanges).forEach(([path, content]) => {
        const updatedPath = this.pathMatchesRename(path, oldPath, isDirectory)
          ? this.replacePathPrefix(path, oldPath, newPath)
          : path
        updatedIgnored[updatedPath] = content
      })
      this.ignoredExternalChanges = updatedIgnored

      const seenRecentPaths = new Set<string>()
      this.recentFiles = this.recentFiles
        .map(file => {
          if (!this.pathMatchesRename(file.path, oldPath, isDirectory)) {
            return file
          }

          const updatedPath = this.replacePathPrefix(file.path, oldPath, newPath)
          return {
            ...file,
            path: updatedPath,
            name: updatedPath.split(/[\\/]/).pop() || file.name,
          }
        })
        .filter(file => {
          if (seenRecentPaths.has(file.path)) {
            return false
          }

          seenRecentPaths.add(file.path)
          return true
        })

      this.saveRecentFiles()
    },

    applyRemoteChange(path: string, content: string): boolean {
      const doc = this.findDocumentByPath(path)
      if (!doc) return false

      if (doc.savedContent === content && doc.content === content) {
        return false
      }

      runDocumentCommand(
        {
          type: 'applyExternalEdit',
          source: 'remote',
          documentId: doc.id,
          path: doc.path,
          contentLength: content.length,
        },
        () => {
          doc.content = content
          doc.savedContent = content
          doc.isDirty = false

          if (this.externalChange?.documentId === doc.id) {
            this.externalChange = null
          }

          delete this.ignoredExternalChanges[doc.path]
          this.lastSaveTime = Date.now()
        }
      )

      return true
    },

    /**
     * Add file to recent files list
     */
    addToRecentFiles(path: string, name: string) {
      // Remove if already exists
      this.recentFiles = this.recentFiles.filter((f) => f.path !== path)

      // Add to beginning
      this.recentFiles.unshift({
        path,
        name,
        lastOpened: Date.now(),
      })

      // Keep only last 10
      this.recentFiles = this.recentFiles.slice(0, 10)

      // Persist to localStorage
      this.saveRecentFiles()
    },

    /**
     * Load recent files from localStorage
     */
    loadRecentFiles() {
      try {
        const stored = localStorage.getItem('kea-recent-files')
        if (stored) {
          this.recentFiles = JSON.parse(stored)
        }
      } catch (error) {
        console.error('Failed to load recent files:', error)
      }
    },

    /**
     * Save recent files to localStorage
     */
    saveRecentFiles() {
      try {
        localStorage.setItem('kea-recent-files', JSON.stringify(this.recentFiles))
      } catch (error) {
        console.error('Failed to save recent files:', error)
      }
    },

    /**
     * Reorder tabs (for drag and drop)
     */
    reorderTabs(fromIndex: number, toIndex: number): void {
      const doc = this.openDocuments.splice(fromIndex, 1)[0]
      this.openDocuments.splice(toIndex, 0, doc)
    },

    /**
     * Get document index
     */
    getDocumentIndex(id: string): number {
      return this.openDocuments.findIndex(d => d.id === id)
    },

    /**
     * Navigate to next/previous tab
     */
    nextTab(): void {
      if (this.openDocuments.length <= 1) return
      const currentIndex = this.activeDocumentId 
        ? this.getDocumentIndex(this.activeDocumentId) 
        : 0
      const nextIndex = (currentIndex + 1) % this.openDocuments.length
      this.activeDocumentId = this.openDocuments[nextIndex].id
    },

    previousTab(): void {
      if (this.openDocuments.length <= 1) return
      const currentIndex = this.activeDocumentId 
        ? this.getDocumentIndex(this.activeDocumentId) 
        : 0
      const prevIndex = (currentIndex - 1 + this.openDocuments.length) % this.openDocuments.length
      this.activeDocumentId = this.openDocuments[prevIndex].id
    },

    /**
     * Clear all state (for cleanup)
     */
    reset(): void {
      this.openDocuments = []
      this.activeDocumentId = null
      this.editorMode = 'source'
      this.externalChange = null
      this.ignoredExternalChanges = {}
      this.isSaving = false
      this.isLoading = false
      this.lastSaveTime = null
    },
  },
})
