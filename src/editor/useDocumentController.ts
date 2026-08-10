import { useCallback, useReducer, useRef } from 'react'
import type {
  DocumentSnapshot,
  DocumentStoragePort,
  OpenedDocumentData,
} from '../core/contracts/document'
import type { FileWatchEventKind } from '../core/contracts/fileWatch'
import { tauriDocumentStoragePort } from '../platform/tauri/documentStorage'

export interface DocumentControllerState {
  documents: DocumentSnapshot[]
  activeDocumentId: string | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
}

export interface DocumentController extends DocumentControllerState {
  activeDocument: DocumentSnapshot | null
  openFileFromPath: (path: string) => Promise<string | null>
  openFileDialog: () => Promise<boolean>
  newFile: () => string
  setActiveDocument: (id: string) => void
  reorderDocuments: (fromIndex: number, toIndex: number) => void
  closeDocument: (id: string, force?: boolean) => Promise<boolean>
  restoreDocuments: (paths: string[], activePath?: string | null) => Promise<void>
  updateContent: (content: string) => void
  saveDocument: (id: string, contentOverride?: string) => Promise<boolean>
  saveDocumentAs: (id: string, contentOverride?: string) => Promise<boolean>
  saveFile: (contentOverride?: string) => Promise<boolean>
  saveFileAs: (contentOverride?: string) => Promise<boolean>
  updatePathsAfterRename: (oldPath: string, newPath: string, isDirectory: boolean) => void
  checkExternalChange: (path: string, kind: FileWatchEventKind) => Promise<void>
  clearError: () => void
}

type Action =
  | { type: 'loading'; value: boolean }
  | { type: 'saving'; value: boolean }
  | { type: 'opened'; document: DocumentSnapshot }
  | { type: 'active'; id: string }
  | { type: 'reordered'; fromIndex: number; toIndex: number }
  | { type: 'created'; document: DocumentSnapshot }
  | { type: 'updated'; id: string; content: string }
  | { type: 'saved'; id: string; content?: string; path?: string; name?: string }
  | { type: 'closed'; id: string }
  | { type: 'renamed'; oldPath: string; newPath: string; isDirectory: boolean }
  | { type: 'external-applied'; id: string; content: string }
  | { type: 'error'; message: string }
  | { type: 'clear-error' }

const initialState: DocumentControllerState = {
  documents: [],
  activeDocumentId: null,
  isLoading: false,
  isSaving: false,
  error: null,
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function generateDocumentId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function pathMatches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}\\`)
}

function replacePathPrefix(path: string, oldPath: string, newPath: string): string {
  return path === oldPath ? newPath : pathMatches(path, oldPath) ? `${newPath}${path.slice(oldPath.length)}` : path
}

function documentFromData(data: OpenedDocumentData, id = generateDocumentId()): DocumentSnapshot {
  return {
    id,
    path: data.path,
    name: data.name,
    content: data.content,
    savedContent: data.content,
    isDirty: false,
    contentRevision: 0,
  }
}

function reducer(state: DocumentControllerState, action: Action): DocumentControllerState {
  switch (action.type) {
    case 'loading':
      return { ...state, isLoading: action.value }
    case 'saving':
      return { ...state, isSaving: action.value }
    case 'opened': {
      const existing = state.documents.find(document => document.path === action.document.path)
      if (existing) return { ...state, activeDocumentId: existing.id, error: null }
      return {
        ...state,
        documents: [...state.documents, action.document],
        activeDocumentId: action.document.id,
        error: null,
      }
    }
    case 'active':
      return state.documents.some(document => document.id === action.id)
        ? { ...state, activeDocumentId: action.id, error: null }
        : state
    case 'reordered': {
      if (
        action.fromIndex === action.toIndex
        || action.fromIndex < 0
        || action.toIndex < 0
        || action.fromIndex >= state.documents.length
        || action.toIndex >= state.documents.length
      ) return state

      const documents = [...state.documents]
      const [document] = documents.splice(action.fromIndex, 1)
      if (!document) return state
      documents.splice(action.toIndex, 0, document)
      return { ...state, documents }
    }
    case 'created':
      return { ...state, documents: [...state.documents, action.document], activeDocumentId: action.document.id, error: null }
    case 'updated':
      return {
        ...state,
        documents: state.documents.map(document => document.id === action.id
          ? { ...document, content: action.content, isDirty: action.content !== document.savedContent }
          : document),
      }
    case 'saved':
      return {
        ...state,
        documents: state.documents.map(document => document.id === action.id
          ? (() => {
              const savedContent = action.content ?? document.content
              return {
                ...document,
                path: action.path ?? document.path,
                name: action.name ?? document.name,
                savedContent,
                isDirty: document.content !== savedContent,
              }
            })()
          : document),
        error: null,
      }
    case 'closed': {
      const index = state.documents.findIndex(document => document.id === action.id)
      if (index < 0) return state
      const documents = state.documents.filter(document => document.id !== action.id)
      const nextActive = state.activeDocumentId !== action.id
        ? state.activeDocumentId
        : documents[Math.min(index, documents.length - 1)]?.id ?? null
      return { ...state, documents, activeDocumentId: nextActive }
    }
    case 'renamed':
      return {
        ...state,
        documents: state.documents.map(document => {
          if (!pathMatches(document.path, action.oldPath) || (!action.isDirectory && document.path !== action.oldPath)) return document
          const path = replacePathPrefix(document.path, action.oldPath, action.newPath)
          return { ...document, path, name: path.split(/[\\/]/).pop() || document.name }
        }),
      }
    case 'external-applied': {
      return {
        ...state,
        documents: state.documents.map(document => document.id === action.id
          ? {
              ...document,
              content: action.content,
              savedContent: action.content,
              isDirty: false,
              contentRevision: document.contentRevision + 1,
            }
          : document),
      }
    }
    case 'error':
      return { ...state, error: action.message }
    case 'clear-error':
      return { ...state, error: null }
    default:
      return state
  }
}

export function useDocumentController(port: DocumentStoragePort = tauriDocumentStoragePort): DocumentController {
  const [state, dispatch] = useReducer(reducer, initialState)
  const stateRef = useRef(state)
  stateRef.current = state
  const activeDocument = state.documents.find(document => document.id === state.activeDocumentId) ?? null

  const openDocument = useCallback(async (data: OpenedDocumentData): Promise<string> => {
    const existing = state.documents.find(document => document.path === data.path)
    const id = existing?.id ?? generateDocumentId()
    dispatch({ type: 'opened', document: documentFromData(data, id) })
    return id
  }, [state.documents])

  const openFileFromPath = useCallback(async (path: string): Promise<string | null> => {
    const existing = state.documents.find(document => document.path === path)
    if (existing) {
      dispatch({ type: 'active', id: existing.id })
      return existing.id
    }

    dispatch({ type: 'loading', value: true })
    dispatch({ type: 'clear-error' })
    try {
      return await openDocument(await port.readFile(path))
    } catch (error) {
      dispatch({ type: 'error', message: `Failed to open file: ${errorMessage(error)}` })
      return null
    } finally {
      dispatch({ type: 'loading', value: false })
    }
  }, [openDocument, port, state.documents])

  const openFileDialog = useCallback(async (): Promise<boolean> => {
    dispatch({ type: 'loading', value: true })
    dispatch({ type: 'clear-error' })
    try {
      await openDocument(await port.openMarkdownFile())
      return true
    } catch (error) {
      if (error !== 'No file selected') dispatch({ type: 'error', message: `Failed to open file: ${errorMessage(error)}` })
      return false
    } finally {
      dispatch({ type: 'loading', value: false })
    }
  }, [openDocument, port])

  const newFile = useCallback((): string => {
    const id = generateDocumentId()
    dispatch({
      type: 'created',
      document: { id, path: '', name: 'Untitled', content: '', savedContent: '', isDirty: false, contentRevision: 0 },
    })
    return id
  }, [])

  const restoreDocuments = useCallback(async (paths: string[], activePath: string | null = null): Promise<void> => {
    const uniquePaths = Array.from(new Set(paths.filter(path => path.length > 0)))
    if (uniquePaths.length === 0) return

    dispatch({ type: 'loading', value: true })
    let restoredActiveId: string | null = null
    try {
      for (const path of uniquePaths) {
        const existing = stateRef.current.documents.find(document => document.path === path)
        if (existing) {
          if (path === activePath) restoredActiveId = existing.id
          continue
        }

        try {
          const document = documentFromData(await port.readFile(path))
          dispatch({ type: 'opened', document })
          if (path === activePath) restoredActiveId = document.id
        } catch {
          // A deleted or inaccessible file should not prevent the rest of the session reopening.
        }
      }
      if (restoredActiveId) dispatch({ type: 'active', id: restoredActiveId })
    } finally {
      dispatch({ type: 'loading', value: false })
    }
  }, [port])

  const setActiveDocument = useCallback((id: string): void => {
    dispatch({ type: 'active', id })
  }, [])

  const reorderDocuments = useCallback((fromIndex: number, toIndex: number): void => {
    dispatch({ type: 'reordered', fromIndex, toIndex })
  }, [])

  const closeDocument = useCallback(async (id: string, force = false): Promise<boolean> => {
    const document = state.documents.find(item => item.id === id)
    if (!document) return false
    if (document.isDirty && !force && !window.confirm(`"${document.name}" has unsaved changes. Do you want to discard them?`)) return false
    dispatch({ type: 'closed', id })
    return true
  }, [state.documents])

  const updateContent = useCallback((content: string): void => {
    const activeId = stateRef.current.activeDocumentId
    if (activeId) dispatch({ type: 'updated', id: activeId, content })
  }, [])

  const saveDocumentAs = useCallback(async (id: string, contentOverride?: string): Promise<boolean> => {
    const document = state.documents.find(item => item.id === id)
    if (!document || state.isSaving) return false
    const content = contentOverride ?? document.content
    dispatch({ type: 'saving', value: true })
    try {
      const result = await port.saveMarkdownFileAs(content)
      dispatch({ type: 'saved', id, content, path: result.path, name: result.name })
      return true
    } catch (error) {
      dispatch({ type: 'error', message: `Failed to save file as: ${errorMessage(error)}` })
      return false
    } finally {
      dispatch({ type: 'saving', value: false })
    }
  }, [port, state.documents, state.isSaving])

  const saveDocument = useCallback(async (id: string, contentOverride?: string): Promise<boolean> => {
    const document = state.documents.find(item => item.id === id)
    if (!document || state.isSaving) return false
    if (!document.path) return saveDocumentAs(id, contentOverride)
    const content = contentOverride ?? document.content
    dispatch({ type: 'saving', value: true })
    try {
      await port.saveMarkdownFile(document.path, content)
      dispatch({ type: 'saved', id, content })
      return true
    } catch (error) {
      dispatch({ type: 'error', message: `Failed to save file: ${errorMessage(error)}` })
      return false
    } finally {
      dispatch({ type: 'saving', value: false })
    }
  }, [port, saveDocumentAs, state.documents, state.isSaving])

  const saveFile = useCallback((contentOverride?: string): Promise<boolean> => activeDocument ? saveDocument(activeDocument.id, contentOverride) : Promise.resolve(false), [activeDocument, saveDocument])

  const saveFileAs = useCallback((contentOverride?: string): Promise<boolean> => activeDocument ? saveDocumentAs(activeDocument.id, contentOverride) : Promise.resolve(false), [activeDocument, saveDocumentAs])

  const updatePathsAfterRename = useCallback((oldPath: string, newPath: string, isDirectory: boolean): void => {
    dispatch({ type: 'renamed', oldPath, newPath, isDirectory })
  }, [])

  const checkExternalChange = useCallback(async (path: string, kind: FileWatchEventKind): Promise<void> => {
    const document = stateRef.current.documents.find(item => item.path === path)
    if (!document || stateRef.current.isLoading) return

    try {
      const diskContent = (await port.readFile(path)).content
      const latest = stateRef.current.documents.find(item => item.id === document.id)
      if (!latest) return
      if (diskContent === latest.savedContent) {
        return
      }
      dispatch({ type: 'external-applied', id: latest.id, content: diskContent })
    } catch (error) {
      if (kind === 'removed') {
        dispatch({ type: 'closed', id: document.id })
        return
      }
      console.error('Failed to reconcile external file change:', error)
    }
  }, [port])

  const clearError = useCallback((): void => {
    dispatch({ type: 'clear-error' })
  }, [])

  return {
    ...state,
    activeDocument,
    openFileFromPath,
    openFileDialog,
    newFile,
    setActiveDocument,
    reorderDocuments,
    closeDocument,
    restoreDocuments,
    updateContent,
    saveDocument,
    saveDocumentAs,
    saveFile,
    saveFileAs,
    updatePathsAfterRename,
    checkExternalChange,
    clearError,
  }
}
