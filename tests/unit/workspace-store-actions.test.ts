import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const workspacePortMock = vi.hoisted(() => ({
  openFolderDialog: vi.fn(),
  readDirectory: vi.fn(),
  createFile: vi.fn(),
  createFolder: vi.fn(),
  renameItem: vi.fn(),
  deleteItem: vi.fn(),
  moveItem: vi.fn(),
}))

vi.mock('../../src/platform/tauri/workspaceFs', () => ({
  tauriWorkspacePort: workspacePortMock,
}))

import { useWorkspaceStore, type FileEntry } from '../../src/modules/workspace/state/workspaceStore'

function makeDir(name: string, path: string, children: FileEntry[] = []): FileEntry {
  return {
    name,
    path,
    is_dir: true,
    is_markdown: false,
    children,
  }
}

function makeFile(name: string, path: string): FileEntry {
  return {
    name,
    path,
    is_dir: false,
    is_markdown: name.endsWith('.md'),
  }
}

describe('workspaceStore actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens a folder and persists the workspace path', async () => {
    workspacePortMock.openFolderDialog.mockResolvedValue({
      path: '/workspace',
      name: 'workspace',
      entries: [makeFile('readme.md', '/workspace/readme.md')],
    })

    const workspaceStore = useWorkspaceStore()
    const opened = await workspaceStore.openFolder()

    expect(opened).toBe(true)
    expect(workspaceStore.rootPath).toBe('/workspace')
    expect(workspaceStore.rootName).toBe('workspace')
    expect(workspaceStore.entries).toHaveLength(1)
    expect(localStorage.getItem('kea-workspace-path')).toBe('/workspace')
  })

  it('handles folder-open cancellation and non-cancellation errors', async () => {
    const workspaceStore = useWorkspaceStore()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    workspacePortMock.openFolderDialog.mockRejectedValueOnce('No folder selected')
    const cancelled = await workspaceStore.openFolder()
    expect(cancelled).toBe(false)
    expect(consoleErrorSpy).not.toHaveBeenCalled()

    workspacePortMock.openFolderDialog.mockRejectedValueOnce(new Error('permission denied'))
    const failed = await workspaceStore.openFolder()
    expect(failed).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to open folder:', expect.any(Error))
  })

  it('returns empty list when loadDirectory fails', async () => {
    const workspaceStore = useWorkspaceStore()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    workspacePortMock.readDirectory.mockRejectedValue(new Error('cannot read'))

    const entries = await workspaceStore.loadDirectory('/workspace')

    expect(entries).toEqual([])
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load directory:', expect.any(Error))
  })

  it('expands/collapses/toggles folders and lazily loads children', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.entries = [makeDir('docs', '/workspace/docs')]
    workspacePortMock.readDirectory.mockResolvedValue([makeFile('note.md', '/workspace/docs/note.md')])

    await workspaceStore.expandFolder('/workspace/docs')
    expect(workspaceStore.isExpanded('/workspace/docs')).toBe(true)
    expect(workspaceStore.findEntry('/workspace/docs/note.md')).not.toBeNull()

    workspaceStore.collapseFolder('/workspace/docs')
    expect(workspaceStore.isExpanded('/workspace/docs')).toBe(false)

    workspaceStore.toggleFolder('/workspace/docs')
    await Promise.resolve()
    expect(workspaceStore.isExpanded('/workspace/docs')).toBe(true)

    workspacePortMock.readDirectory.mockClear()
    await workspaceStore.expandFolder('/workspace/docs')
    expect(workspacePortMock.readDirectory).not.toHaveBeenCalled()
  })

  it('creates file/folder entries within a parent folder', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [makeDir('workspace', '/workspace')]

    workspacePortMock.createFile.mockResolvedValue({
      path: '/workspace/new.md',
      content: '',
      name: 'new.md',
    })
    workspacePortMock.createFolder.mockResolvedValue(makeDir('assets', '/workspace/assets'))

    const createdFile = await workspaceStore.createFile('/workspace', 'new.md')
    const createdFolder = await workspaceStore.createFolder('/workspace', 'assets')

    expect(createdFile?.path).toBe('/workspace/new.md')
    expect(createdFolder?.path).toBe('/workspace/assets')
    expect(workspaceStore.findEntry('/workspace/new.md')).not.toBeNull()
    expect(workspaceStore.findEntry('/workspace/assets')).not.toBeNull()
  })

  it('renames a directory and updates descendants/expanded folders/root path', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace/docs'
    workspaceStore.rootName = 'docs'
    workspaceStore.entries = [
      makeDir('docs', '/workspace/docs', [
        makeFile('note.md', '/workspace/docs/note.md'),
      ]),
    ]
    workspaceStore.expandedFolders = new Set(['/workspace/docs', '/workspace/docs/sub'])

    workspacePortMock.renameItem.mockResolvedValue('/workspace/archive')

    const newPath = await workspaceStore.renameItem('/workspace/docs', 'archive')

    expect(newPath).toBe('/workspace/archive')
    expect(workspaceStore.rootPath).toBe('/workspace/archive')
    expect(workspaceStore.rootName).toBe('archive')
    expect(workspaceStore.findEntry('/workspace/archive/note.md')).not.toBeNull()
    expect(workspaceStore.expandedFolders.has('/workspace/archive')).toBe(true)
    expect(workspaceStore.expandedFolders.has('/workspace/archive/sub')).toBe(true)
  })

  it('moves a file to another directory and updates tree paths', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeDir('workspace', '/workspace', [
        makeDir('a', '/workspace/a', [makeFile('note.md', '/workspace/a/note.md')]),
        makeDir('b', '/workspace/b'),
      ]),
    ]

    workspacePortMock.moveItem.mockResolvedValue('/workspace/b/note.md')

    const movedPath = await workspaceStore.moveItem('/workspace/a/note.md', '/workspace/b')

    expect(movedPath).toBe('/workspace/b/note.md')
    expect(workspaceStore.findEntry('/workspace/b/note.md')).not.toBeNull()
    expect(workspaceStore.findEntry('/workspace/a/note.md')).toBeNull()
  })

  it('moves a directory and updates descendant paths', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeDir('workspace', '/workspace', [
        makeDir('a', '/workspace/a', [
          makeDir('src', '/workspace/a/src', [makeFile('child.md', '/workspace/a/src/child.md')]),
        ]),
        makeDir('b', '/workspace/b'),
      ]),
    ]

    workspacePortMock.moveItem.mockResolvedValue('/workspace/b/src')

    const movedPath = await workspaceStore.moveItem('/workspace/a/src', '/workspace/b')

    expect(movedPath).toBe('/workspace/b/src')
    expect(workspaceStore.findEntry('/workspace/b/src/child.md')).not.toBeNull()
    expect(workspaceStore.findEntry('/workspace/a/src')).toBeNull()
  })

  it('rethrows move errors from the port', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeDir('workspace', '/workspace', [
        makeDir('a', '/workspace/a', [makeFile('note.md', '/workspace/a/note.md')]),
        makeDir('b', '/workspace/b'),
      ]),
    ]

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    workspacePortMock.moveItem.mockRejectedValue(new Error('move failed'))

    await expect(workspaceStore.moveItem('/workspace/a/note.md', '/workspace/b')).rejects.toThrow('move failed')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to move item:', expect.any(Error))
  })

  it('initialises missing target children collection when moving into folder', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      {
        name: 'workspace',
        path: '/workspace',
        is_dir: true,
        is_markdown: false,
        children: [
          makeFile('note.md', '/workspace/note.md'),
          {
            name: 'target',
            path: '/workspace/target',
            is_dir: true,
            is_markdown: false,
          } as FileEntry,
        ],
      },
    ]

    workspacePortMock.moveItem.mockResolvedValue('/workspace/target/note.md')

    const movedPath = await workspaceStore.moveItem('/workspace/note.md', '/workspace/target')

    expect(movedPath).toBe('/workspace/target/note.md')
    expect(workspaceStore.findEntry('/workspace/target/note.md')).not.toBeNull()
  })

  it('returns null when move target is not a directory', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeDir('workspace', '/workspace', [
        makeFile('note.md', '/workspace/note.md'),
        makeFile('file-target.md', '/workspace/file-target.md'),
      ]),
    ]

    const movedPath = await workspaceStore.moveItem('/workspace/note.md', '/workspace/file-target.md')

    expect(movedPath).toBeNull()
    expect(workspacePortMock.moveItem).not.toHaveBeenCalled()
  })

  it('returns null when source parent collection cannot be resolved', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeDir('workspace', '/workspace', [
        makeFile('note.md', '/workspace/note.md'),
        makeDir('target', '/workspace/target'),
      ]),
    ]

    vi.spyOn(workspaceStore, 'findParentCollection').mockReturnValue(null)

    const movedPath = await workspaceStore.moveItem('/workspace/note.md', '/workspace/target')

    expect(movedPath).toBeNull()
  })

  it('returns null when source index is missing in parent collection', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [makeDir('workspace', '/workspace', [makeDir('target', '/workspace/target')])]

    vi.spyOn(workspaceStore, 'findParentCollection').mockReturnValue([])

    const movedPath = await workspaceStore.moveItem('/workspace/note.md', '/workspace/target')

    expect(movedPath).toBeNull()
  })

  it('rejects invalid move requests', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeDir('workspace', '/workspace', [
        makeDir('a', '/workspace/a', [makeFile('note.md', '/workspace/a/note.md')]),
      ]),
    ]

    expect(await workspaceStore.moveItem('/workspace/missing.md', '/workspace/a')).toBeNull()
    expect(await workspaceStore.moveItem('/workspace', '/workspace/a')).toBeNull()
    expect(await workspaceStore.moveItem('/workspace/a/note.md', '/workspace/a')).toBeNull()
    expect(await workspaceStore.moveItem('/workspace/a', '/workspace/a/child')).toBeNull()
    expect(workspacePortMock.moveItem).not.toHaveBeenCalled()
  })

  it('deletes entries and clears expanded descendants', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.entries = [
      makeDir('workspace', '/workspace', [
        makeDir('docs', '/workspace/docs', [makeFile('note.md', '/workspace/docs/note.md')]),
      ]),
    ]
    workspaceStore.expandedFolders = new Set(['/workspace/docs', '/workspace/docs/sub', '/workspace/keep'])
    workspacePortMock.deleteItem.mockResolvedValue(undefined)

    const deleted = await workspaceStore.deleteItem('/workspace/docs')

    expect(deleted).toBe(true)
    expect(workspaceStore.findEntry('/workspace/docs')).toBeNull()
    expect(workspaceStore.expandedFolders.has('/workspace/docs')).toBe(false)
    expect(workspaceStore.expandedFolders.has('/workspace/docs/sub')).toBe(false)
    expect(workspaceStore.expandedFolders.has('/workspace/keep')).toBe(true)
  })

  it('refreshes root and nested directories', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeDir('docs', '/workspace/docs', [makeFile('old.md', '/workspace/docs/old.md')]),
    ]

    workspacePortMock.readDirectory
      .mockResolvedValueOnce([
        makeDir('docs', '/workspace/docs', []),
        makeFile('root.md', '/workspace/root.md'),
      ])
      .mockResolvedValueOnce([makeFile('nested.md', '/workspace/docs/nested.md')])

    await workspaceStore.refreshDirectory('/workspace')
    expect(workspaceStore.findEntry('/workspace/root.md')).not.toBeNull()

    await workspaceStore.refreshDirectory('/workspace/docs')
    expect(workspaceStore.findEntry('/workspace/docs/nested.md')).not.toBeNull()
  })

  it('restores workspace from saved path', async () => {
    localStorage.setItem('kea-workspace-path', '/workspace/restored')
    workspacePortMock.readDirectory.mockResolvedValue([makeFile('welcome.md', '/workspace/restored/welcome.md')])

    const workspaceStore = useWorkspaceStore()
    const restored = await workspaceStore.restoreWorkspace()

    expect(restored).toBe(true)
    expect(workspaceStore.rootPath).toBe('/workspace/restored')
    expect(workspaceStore.rootName).toBe('restored')
    expect(workspaceStore.entries).toHaveLength(1)
  })

  it('handles restore failures and clears stale path', async () => {
    localStorage.setItem('kea-workspace-path', '/workspace/stale')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    workspacePortMock.readDirectory.mockRejectedValue(new Error('missing'))

    const workspaceStore = useWorkspaceStore()
    const restored = await workspaceStore.restoreWorkspace()

    expect(restored).toBe(false)
    expect(localStorage.getItem('kea-workspace-path')).toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to restore workspace:', expect.any(Error))
  })

  it('closes workspace and clears persisted path', () => {
    localStorage.setItem('kea-workspace-path', '/workspace')
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [makeFile('note.md', '/workspace/note.md')]
    workspaceStore.expandedFolders = new Set(['/workspace'])

    workspaceStore.closeWorkspace()

    expect(workspaceStore.rootPath).toBeNull()
    expect(workspaceStore.rootName).toBeNull()
    expect(workspaceStore.entries).toEqual([])
    expect(workspaceStore.expandedFolders.size).toBe(0)
    expect(localStorage.getItem('kea-workspace-path')).toBeNull()
  })

  it('handles removeEntry misses and saveWorkspacePath with null root', () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.entries = [makeFile('note.md', '/workspace/note.md')]

    expect(workspaceStore.removeEntry('/workspace/missing.md')).toBe(false)

    workspaceStore.rootPath = null
    workspaceStore.saveWorkspacePath()
    expect(localStorage.getItem('kea-workspace-path')).toBeNull()
  })
})
