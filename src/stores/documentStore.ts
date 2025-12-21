import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'

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

export const useDocumentStore = defineStore('document', {
  state: () => ({
    openDocuments: [] as OpenDocument[],
    activeDocumentId: null as string | null,
    recentFiles: [] as RecentFile[],
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

      this.openDocuments.push(doc)
      this.activeDocumentId = id
      this.addToRecentFiles(path, name)
      this.lastSaveTime = Date.now()

      return id
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
        const result = await invoke<{ path: string; content: string; name: string }>('read_file', { path })
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
        this.activeDocumentId = id
      }
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

      return true
    },

    /**
     * Close all documents
     */
    async closeAllDocuments(force = false): Promise<boolean> {
      if (!force && this.hasAnyUnsavedChanges) {
        const confirmed = confirm('You have unsaved changes. Do you want to discard them?')
        if (!confirmed) return false
      }

      this.openDocuments = []
      this.activeDocumentId = null
      return true
    },

    /**
     * Update the current file content (called when editor changes)
     */
    updateContent(newContent: string): void {
      const doc = this.activeDocument
      if (!doc) return
      doc.content = newContent
      doc.isDirty = newContent !== doc.savedContent
    },

    /**
     * Update content for a specific document
     */
    updateDocumentContent(id: string, newContent: string): void {
      const doc = this.openDocuments.find(d => d.id === id)
      if (!doc) return
      doc.content = newContent
      doc.isDirty = newContent !== doc.savedContent
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

        await invoke('save_markdown_file', {
          path: doc.path,
          content: doc.content,
        })

        doc.savedContent = doc.content
        doc.isDirty = false
        this.lastSaveTime = Date.now()

        return true
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
          await invoke('save_markdown_file', {
            path: doc.path,
            content: doc.content,
          })
          doc.savedContent = doc.content
          doc.isDirty = false
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

        const result = await invoke<{ path: string; name: string }>('save_markdown_file_as', {
          content: doc.content,
        })

        doc.path = result.path
        doc.name = result.name
        doc.savedContent = doc.content
        doc.isDirty = false
        this.lastSaveTime = Date.now()

        this.addToRecentFiles(result.path, result.name)

        return true
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

        const result = await invoke<{ path: string; content: string; name: string }>(
          'open_markdown_file'
        )

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

      this.openDocuments.push(doc)
      this.activeDocumentId = id

      return id
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
        const stored = localStorage.getItem('orca-recent-files')
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
        localStorage.setItem('orca-recent-files', JSON.stringify(this.recentFiles))
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
      this.isSaving = false
      this.isLoading = false
      this.lastSaveTime = null
    },
  },
})