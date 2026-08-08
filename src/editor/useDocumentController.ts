import { useCallback, useReducer } from 'react'
import type {
  DocumentSnapshot,
  DocumentStoragePort,
  OpenedDocumentData,
} from '../core/contracts/document'
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
  updateContent: (content: string) => void
  saveFile: () => Promise<boolean>
  saveFileAs: () => Promise<boolean>
  updatePathsAfterRename: (oldPath: string, newPath: string, isDirectory: boolean) => void
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
  | { type: 'saved'; id: string; path?: string; name?: string }
  | { type: 'closed'; id: string }
  | { type: 'renamed'; oldPath: string; newPath: string; isDirectory: boolean }
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
          ? {
              ...document,
              path: action.path ?? document.path,
              name: action.name ?? document.name,
              savedContent: document.content,
              isDirty: false,
            }
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
      document: { id, path: '', name: 'Untitled', content: '', savedContent: '', isDirty: false },
    })
    return id
  }, [])

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
    if (activeDocument) dispatch({ type: 'updated', id: activeDocument.id, content })
  }, [activeDocument])

  const saveFile = useCallback(async (): Promise<boolean> => {
    if (!activeDocument || state.isSaving) return false
    if (!activeDocument.path) return saveFileAs()
    dispatch({ type: 'saving', value: true })
    try {
      await port.saveMarkdownFile(activeDocument.path, activeDocument.content)
      dispatch({ type: 'saved', id: activeDocument.id })
      return true
    } catch (error) {
      dispatch({ type: 'error', message: `Failed to save file: ${errorMessage(error)}` })
      return false
    } finally {
      dispatch({ type: 'saving', value: false })
    }
  }, [activeDocument, port, state.isSaving])

  const saveFileAs = useCallback(async (): Promise<boolean> => {
    if (!activeDocument || state.isSaving) return false
    dispatch({ type: 'saving', value: true })
    try {
      const result = await port.saveMarkdownFileAs(activeDocument.content)
      dispatch({ type: 'saved', id: activeDocument.id, path: result.path, name: result.name })
      return true
    } catch (error) {
      dispatch({ type: 'error', message: `Failed to save file as: ${errorMessage(error)}` })
      return false
    } finally {
      dispatch({ type: 'saving', value: false })
    }
  }, [activeDocument, port, state.isSaving])

  const updatePathsAfterRename = useCallback((oldPath: string, newPath: string, isDirectory: boolean): void => {
    dispatch({ type: 'renamed', oldPath, newPath, isDirectory })
  }, [])

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
    updateContent,
    saveFile,
    saveFileAs,
    updatePathsAfterRename,
    clearError,
  }
}
