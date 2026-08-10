import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { WorkspacePort } from '../core/contracts/workspace'
import { tauriWorkspacePort } from '../platform/tauri/workspaceFs'
import {
  buildChildPath, deleteEntry, findEntry, getPathName, insertEntry, moveEntry, pathMatches,
  renameEntry, replaceChildren, rewritePath, sortEntries, validateItemName, getParentPath,
  type WorkspaceFileEntry,
} from './workspaceModel'

export interface WorkspaceState {
  rootPath: string | null
  rootName: string | null
  entries: WorkspaceFileEntry[]
  expandedPaths: Set<string>
  loading: boolean
  loadingPaths: Set<string>
  error: string | null
}

export interface WorkspaceControllerOptions {
  /** Disabled by default so the isolated shell never restores a workspace implicitly. */
  restoreWorkspaceOnLaunch?: boolean | (() => boolean | Promise<boolean>)
  windowLabel?: string
}

export interface WorkspaceController extends WorkspaceState {
  openFolder: () => Promise<boolean>
  restoreWorkspace: () => Promise<boolean>
  toggleFolder: (path: string) => Promise<void>
  refreshDirectory: (path?: string) => Promise<void>
  createFile: (parentPath: string, name: string) => Promise<WorkspaceFileEntry | null>
  createFolder: (parentPath: string, name: string) => Promise<WorkspaceFileEntry | null>
  renameItem: (path: string, name: string) => Promise<string | null>
  deleteItem: (path: string) => Promise<boolean>
  moveItem: (sourcePath: string, targetDir: string) => Promise<string | null>
  duplicateItem: (path: string) => Promise<string | null>
  openItem: (path: string) => Promise<void>
  revealItem: (path: string) => Promise<void>
  closeWorkspace: () => void
  clearError: () => void
}

type Action =
  | { type: 'loading'; value: boolean }
  | { type: 'folder-loading'; path: string; value: boolean; generation: number }
  | { type: 'opened'; data: { path: string; name: string; entries: WorkspaceFileEntry[] } }
  | { type: 'entries'; path: string; entries: WorkspaceFileEntry[] }
  | { type: 'set-entries'; entries: WorkspaceFileEntry[] }
  | { type: 'expanded'; path: string; value: boolean }
  | { type: 'mutate'; update: (entries: WorkspaceFileEntry[]) => WorkspaceFileEntry[] }
  | { type: 'root'; oldPath: string; path: string; name: string }
  | { type: 'closed' }
  | { type: 'error'; message: string }
  | { type: 'clear-error' }

const initialState: WorkspaceState = {
  rootPath: null, rootName: null, entries: [], expandedPaths: new Set(), loading: false, loadingPaths: new Set(), error: null,
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'loading': return { ...state, loading: action.value }
    case 'folder-loading': {
      const paths = new Set(state.loadingPaths)
      if (action.value) paths.add(action.path); else paths.delete(action.path)
      return { ...state, loadingPaths: paths }
    }
    case 'opened': return { ...state, rootPath: action.data.path, rootName: action.data.name, entries: sortEntries(action.data.entries), expandedPaths: new Set(), loadingPaths: new Set(), error: null }
    case 'entries': return { ...state, entries: state.rootPath === action.path ? sortEntries(action.entries) : replaceChildren(state.entries, action.path, action.entries) }
    case 'set-entries': return { ...state, entries: sortEntries(action.entries) }
    case 'expanded': {
      const paths = new Set(state.expandedPaths)
      if (action.value) paths.add(action.path); else paths.delete(action.path)
      return { ...state, expandedPaths: paths }
    }
    case 'mutate': return { ...state, entries: action.update(state.entries), loadingPaths: new Set() }
    case 'root': return state.rootPath === action.oldPath ? { ...state, rootPath: action.path, rootName: action.name } : state
    case 'closed': return initialState
    case 'error': return { ...state, error: action.message }
    case 'clear-error': return { ...state, error: null }
    default: return state
  }
}

export function useWorkspaceController(
  port: WorkspacePort = tauriWorkspacePort,
  options: WorkspaceControllerOptions = {},
): WorkspaceController {
  const workspaceStorageKey = `kea-workspace-path:${options.windowLabel ?? 'main'}`
  const [state, dispatch] = useReducer(reducer, initialState)
  // This generation invalidates both the result and the continuation of every
  // read. Mutations bump it before starting I/O, so a late read cannot put
  // stale children back into the tree or expand its caller's folder.
  const requestRef = useRef(0)
  const workspaceRef = useRef(0)
  const restoredRef = useRef(false)

  const readDirectory = useCallback(async (path: string, generation: number): Promise<WorkspaceFileEntry[] | null> => {
    if (generation !== requestRef.current) return null
    dispatch({ type: 'folder-loading', path, value: true, generation })
    try {
      const entries = await port.readDirectory(path)
      if (generation !== requestRef.current) return null
      dispatch({ type: 'entries', path, entries })
      return entries
    } catch (error) {
      if (generation === requestRef.current) dispatch({ type: 'error', message: `Failed to load workspace: ${errorMessage(error)}` })
      return null
    } finally {
      if (generation === requestRef.current) dispatch({ type: 'folder-loading', path, value: false, generation })
    }
  }, [port])

  const openFolder = useCallback(async (): Promise<boolean> => {
    const request = ++requestRef.current
    ++workspaceRef.current
    dispatch({ type: 'loading', value: true })
    dispatch({ type: 'clear-error' })
    try {
      const result = await port.openFolderDialog()
      if (request !== requestRef.current) return false
      dispatch({ type: 'opened', data: result })
      window.localStorage.setItem(workspaceStorageKey, result.path)
      return true
    } catch (error) {
      if (request === requestRef.current && error !== 'No folder selected') dispatch({ type: 'error', message: `Failed to open folder: ${errorMessage(error)}` })
      return false
    } finally {
      if (request === requestRef.current) dispatch({ type: 'loading', value: false })
    }
  }, [port, workspaceStorageKey])

  const restoreWorkspace = useCallback(async (): Promise<boolean> => {
    const savedPath = window.localStorage.getItem(workspaceStorageKey)
    if (!savedPath) return false
    const request = ++requestRef.current
    ++workspaceRef.current
    dispatch({ type: 'loading', value: true })
    dispatch({ type: 'clear-error' })
    try {
      const entries = await port.readDirectory(savedPath)
      if (request !== requestRef.current) return false
      dispatch({ type: 'opened', data: { path: savedPath, name: getPathName(savedPath), entries } })
      return true
    } catch (error) {
      if (request === requestRef.current) {
        window.localStorage.removeItem(workspaceStorageKey)
        dispatch({ type: 'error', message: `Failed to restore workspace: ${errorMessage(error)}` })
      }
      return false
    } finally {
      if (request === requestRef.current) dispatch({ type: 'loading', value: false })
    }
  }, [port, workspaceStorageKey])

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const capability = options.restoreWorkspaceOnLaunch
    const shouldRestore = typeof capability === 'function' ? Promise.resolve(capability()) : Promise.resolve(capability === true)
    void shouldRestore.then(enabled => {
      if (enabled && restoredRef.current && requestRef.current === 0) void restoreWorkspace()
    })
  }, [options.restoreWorkspaceOnLaunch, restoreWorkspace])

  const toggleFolder = useCallback(async (path: string): Promise<void> => {
    if (state.expandedPaths.has(path)) {
      dispatch({ type: 'expanded', path, value: false }); return
    }
    const entry = findEntry(state.entries, path)
    if (!entry?.is_dir) return
    const generation = ++requestRef.current
    const entries = await readDirectory(path, generation)
    if (!entries || generation !== requestRef.current) return
    if (generation === requestRef.current) dispatch({ type: 'expanded', path, value: true })
  }, [readDirectory, state.entries, state.expandedPaths])

  const refreshDirectory = useCallback(async (path = state.rootPath ?? ''): Promise<void> => {
    if (!path) return
    const generation = ++requestRef.current
    const entries = await readDirectory(path, generation)
    if (entries && generation === requestRef.current && state.expandedPaths.has(path)) dispatch({ type: 'expanded', path, value: true })
  }, [readDirectory, state.expandedPaths, state.rootPath])

  const create = useCallback(async (parentPath: string, name: string, folder: boolean): Promise<WorkspaceFileEntry | null> => {
    if (!validateItemName(name)) { dispatch({ type: 'error', message: 'Name cannot be empty or contain path separators.' }); return null }
    const workspace = workspaceRef.current
    ++requestRef.current
    try {
      const result = folder ? await port.createFolder(buildChildPath(parentPath, name)) : await port.createFile(buildChildPath(parentPath, name), '')
      const entry: WorkspaceFileEntry = folder
        ? result as WorkspaceFileEntry
        : { name: result.name, path: result.path, is_dir: false, is_markdown: result.name.toLowerCase().endsWith('.md') }
      if (workspace === workspaceRef.current) dispatch({ type: 'mutate', update: entries => insertEntry(entries, parentPath === state.rootPath ? null : parentPath, entry) })
      return entry
    } catch (error) { if (workspace === workspaceRef.current) dispatch({ type: 'error', message: `Failed to create ${folder ? 'folder' : 'file'}: ${errorMessage(error)}` }); return null }
  }, [port, state.entries, state.rootPath, workspaceStorageKey])

  const renameItem = useCallback(async (path: string, name: string): Promise<string | null> => {
    if (!validateItemName(name)) { dispatch({ type: 'error', message: 'Name cannot be empty or contain path separators.' }); return null }
    const entry = findEntry(state.entries, path)
    if (!entry) return null
    const workspace = workspaceRef.current
    ++requestRef.current
    try {
      const newPath = await port.renameItem(path, name)
      if (workspace !== workspaceRef.current) return null
      dispatch({ type: 'mutate', update: entries => renameEntry(entries, path, newPath, name) })
      if (path === state.rootPath) { dispatch({ type: 'root', oldPath: path, path: newPath, name }); window.localStorage.setItem(workspaceStorageKey, newPath) }
      return newPath
    } catch (error) { if (workspace === workspaceRef.current) dispatch({ type: 'error', message: `Failed to rename: ${errorMessage(error)}` }); return null }
  }, [port, state.entries, state.rootPath])

  const deleteItem = useCallback(async (path: string): Promise<boolean> => {
    if (path === state.rootPath || !findEntry(state.entries, path)) return false
    const workspace = workspaceRef.current
    ++requestRef.current
    try {
      await port.deleteItem(path)
      if (workspace !== workspaceRef.current) return false
      dispatch({ type: 'mutate', update: entries => deleteEntry(entries, path) })
      return true
    } catch (error) { if (workspace === workspaceRef.current) dispatch({ type: 'error', message: `Failed to delete: ${errorMessage(error)}` }); return false }
  }, [port, state.entries, state.rootPath])

  const moveItem = useCallback(async (sourcePath: string, targetDir: string): Promise<string | null> => {
    const source = findEntry(state.entries, sourcePath)
    const target = targetDir === state.rootPath ? { is_dir: true } : findEntry(state.entries, targetDir)
    if (!source || !target || !target.is_dir || sourcePath === state.rootPath || sourcePath === targetDir || pathMatches(targetDir, sourcePath) || sourcePath.slice(0, Math.max(sourcePath.lastIndexOf('/'), sourcePath.lastIndexOf('\\'))) === targetDir) return null
    const workspace = workspaceRef.current
    ++requestRef.current
    try {
      const newPath = await port.moveItem(sourcePath, targetDir)
      if (workspace !== workspaceRef.current) return null
      const destination = targetDir === state.rootPath ? '' : targetDir
      dispatch({ type: 'mutate', update: entries => moveEntry(entries, sourcePath, destination, newPath) ?? entries })
      return newPath
    } catch (error) { if (workspace === workspaceRef.current) dispatch({ type: 'error', message: `Failed to move item: ${errorMessage(error)}` }); return null }
  }, [port, state.entries, state.rootPath])

  const duplicateItem = useCallback(async (path: string): Promise<string | null> => {
    const source = findEntry(state.entries, path)
    const parentPath = getParentPath(path) ?? state.rootPath
    if (!source || !parentPath || path === state.rootPath) return null
    const workspace = workspaceRef.current
    ++requestRef.current
    try {
      const newPath = await port.duplicateItem(path)
      if (workspace !== workspaceRef.current) return null
      await refreshDirectory(parentPath)
      return newPath
    } catch (error) {
      if (workspace === workspaceRef.current) dispatch({ type: 'error', message: `Failed to duplicate: ${errorMessage(error)}` })
      return null
    }
  }, [port, refreshDirectory, state.entries, state.rootPath])

  const closeWorkspace = useCallback((): void => {
    ++requestRef.current
    ++workspaceRef.current
    window.localStorage.removeItem(workspaceStorageKey)
    dispatch({ type: 'closed' })
  }, [workspaceStorageKey])

  const openItem = useCallback(async (path: string): Promise<void> => {
    try {
      await port.openItem(path)
    } catch (error) {
      dispatch({ type: 'error', message: `Failed to open item: ${errorMessage(error)}` })
    }
  }, [port])

  const revealItem = useCallback(async (path: string): Promise<void> => {
    try {
      await port.revealItem(path)
    } catch (error) {
      dispatch({ type: 'error', message: `Failed to reveal item: ${errorMessage(error)}` })
    }
  }, [port])

  return { ...state, openFolder, restoreWorkspace, toggleFolder, refreshDirectory, createFile: (parent, name) => create(parent, name, false), createFolder: (parent, name) => create(parent, name, true), renameItem, deleteItem, moveItem, duplicateItem, openItem, revealItem, closeWorkspace, clearError: () => dispatch({ type: 'clear-error' }) }
}

export function rewriteWorkspacePath(path: string, oldPath: string, newPath: string): string { return rewritePath(path, oldPath, newPath) }
