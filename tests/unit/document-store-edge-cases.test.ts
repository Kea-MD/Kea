import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const documentStoragePortMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  openMarkdownFile: vi.fn(),
  saveMarkdownFile: vi.fn(),
  saveMarkdownFileAs: vi.fn(),
}))

vi.mock('../../src/platform/tauri/documentStorage', () => ({
  tauriDocumentStoragePort: documentStoragePortMock,
}))

import type { OpenDocument } from '../../src/modules/editor/state/documentStore'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'

function makeDocument(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    id: 'doc-1',
    path: '/workspace/doc.md',
    name: 'doc.md',
    content: '# content',
    savedContent: '# content',
    isDirty: false,
    ...overrides,
  }
}

describe('documentStore edge cases', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps dirty tab open when close confirmation is cancelled', async () => {
    const documentStore = useDocumentStore()
    const id = documentStore.newFile()
    documentStore.updateContent('dirty changes')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    const closed = await documentStore.closeDocument(id)

    expect(closed).toBe(false)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(documentStore.openDocuments).toHaveLength(1)
  })

  it('aborts close-all when confirmation is cancelled', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [
      makeDocument({ id: 'doc-1', isDirty: true }),
      makeDocument({ id: 'doc-2', path: '/workspace/other.md', name: 'other.md', isDirty: false }),
    ]
    documentStore.activeDocumentId = 'doc-1'
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    const closed = await documentStore.closeAllDocuments()

    expect(closed).toBe(false)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(documentStore.openDocuments).toHaveLength(2)
  })

  it('returns false from saveAllFiles when any save fails', async () => {
    const documentStore = useDocumentStore()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    documentStore.openDocuments = [
      makeDocument({ id: 'doc-1', content: 'first', savedContent: 'old first', isDirty: true }),
      makeDocument({ id: 'doc-2', path: '/workspace/two.md', name: 'two.md', content: 'second', savedContent: 'old second', isDirty: true }),
    ]

    documentStoragePortMock.saveMarkdownFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('disk full'))

    const saved = await documentStore.saveAllFiles()

    expect(saved).toBe(false)
    expect(documentStore.openDocuments[0].isDirty).toBe(false)
    expect(documentStore.openDocuments[1].isDirty).toBe(true)
  })

  it('handles openFileDialog cancellation sentinel without logging errors', async () => {
    const documentStore = useDocumentStore()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    documentStoragePortMock.openMarkdownFile.mockRejectedValue('No file selected')

    const opened = await documentStore.openFileDialog()

    expect(opened).toBe(false)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('applies external disk changes immediately when current doc is clean', async () => {
    const documentStore = useDocumentStore()
    await documentStore.openFile('/workspace/doc.md', '# original', 'doc.md')
    documentStoragePortMock.readFile.mockResolvedValue({
      path: '/workspace/doc.md',
      name: 'doc.md',
      content: '# from disk',
    })

    await documentStore.checkActiveDocumentExternalChange()

    expect(documentStore.activeDocument?.content).toBe('# from disk')
    expect(documentStore.activeDocument?.savedContent).toBe('# from disk')
    expect(documentStore.hasExternalChange).toBe(false)
  })

  it('clears pending external change when disk content matches saved content', async () => {
    const documentStore = useDocumentStore()
    await documentStore.openFile('/workspace/doc.md', '# same', 'doc.md')
    const docId = documentStore.activeDocumentId as string
    documentStore.externalChange = {
      documentId: docId,
      path: '/workspace/doc.md',
      diskContent: '# stale warning',
      detectedAt: Date.now(),
    }
    documentStore.ignoredExternalChanges['/workspace/doc.md'] = '# stale warning'

    documentStoragePortMock.readFile.mockResolvedValue({
      path: '/workspace/doc.md',
      name: 'doc.md',
      content: '# same',
    })

    await documentStore.checkActiveDocumentExternalChange()

    expect(documentStore.externalChange).toBeNull()
    expect(documentStore.ignoredExternalChanges['/workspace/doc.md']).toBeUndefined()
  })

  it('ignores known external content snapshots for dirty docs', async () => {
    const documentStore = useDocumentStore()
    await documentStore.openFile('/workspace/doc.md', '# original', 'doc.md')
    documentStore.updateContent('# local edit')
    documentStore.ignoredExternalChanges['/workspace/doc.md'] = '# known disk'

    documentStoragePortMock.readFile.mockResolvedValue({
      path: '/workspace/doc.md',
      name: 'doc.md',
      content: '# known disk',
    })

    await documentStore.checkActiveDocumentExternalChange()

    expect(documentStore.hasExternalChange).toBe(false)
  })

  it('does not log missing-file errors during external change checks', async () => {
    const documentStore = useDocumentStore()
    await documentStore.openFile('/workspace/doc.md', '# original', 'doc.md')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    documentStoragePortMock.readFile.mockRejectedValue(new Error('file does not exist'))

    await documentStore.checkActiveDocumentExternalChange()

    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('logs non-missing external change check errors', async () => {
    const documentStore = useDocumentStore()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await documentStore.openFile('/workspace/doc.md', '# original', 'doc.md')
    documentStoragePortMock.readFile.mockRejectedValue(new Error('permission denied'))

    await documentStore.checkActiveDocumentExternalChange()

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to check external file changes:', expect.any(Error))
  })

  it('throws save-as errors and clears saving state', async () => {
    const documentStore = useDocumentStore()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    documentStore.newFile()
    documentStore.updateContent('draft')
    documentStoragePortMock.saveMarkdownFileAs.mockRejectedValue(new Error('cannot save'))

    await expect(documentStore.saveFileAs()).rejects.toThrow('cannot save')
    expect(documentStore.isSaving).toBe(false)
  })

  it('cycles tabs using nextTab and previousTab', () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [
      makeDocument({ id: 'doc-1' }),
      makeDocument({ id: 'doc-2', path: '/workspace/2.md', name: '2.md' }),
      makeDocument({ id: 'doc-3', path: '/workspace/3.md', name: '3.md' }),
    ]
    documentStore.activeDocumentId = 'doc-1'

    documentStore.nextTab()
    expect(documentStore.activeDocumentId).toBe('doc-2')

    documentStore.previousTab()
    expect(documentStore.activeDocumentId).toBe('doc-1')
  })

  it('reads file from disk in openFileFromPath and handles read errors', async () => {
    const documentStore = useDocumentStore()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    documentStoragePortMock.readFile.mockResolvedValueOnce({
      path: '/workspace/from-disk.md',
      name: 'from-disk.md',
      content: '# from disk',
    })

    const openedId = await documentStore.openFileFromPath('/workspace/from-disk.md')
    expect(openedId).toBeTruthy()
    expect(documentStore.activeDocument?.name).toBe('from-disk.md')

    documentStoragePortMock.readFile.mockRejectedValueOnce(new Error('read failed'))
    await expect(documentStore.openFileFromPath('/workspace/broken.md')).rejects.toThrow('read failed')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to open file:', expect.any(Error))
  })

  it('updates document content by id and ignores unknown ids', () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [
      makeDocument({ id: 'doc-1', content: 'old', savedContent: 'old', isDirty: false }),
    ]

    documentStore.updateDocumentContent('doc-1', 'new')
    expect(documentStore.openDocuments[0].content).toBe('new')
    expect(documentStore.openDocuments[0].isDirty).toBe(true)

    documentStore.updateDocumentContent('missing', 'ignored')
    expect(documentStore.openDocuments).toHaveLength(1)
  })

  it('returns false from saveFile when there is no active doc or while already saving', async () => {
    const documentStore = useDocumentStore()
    expect(await documentStore.saveFile()).toBe(false)

    documentStore.openDocuments = [makeDocument()]
    documentStore.activeDocumentId = 'doc-1'
    documentStore.isSaving = true
    expect(await documentStore.saveFile()).toBe(false)
  })

  it('rethrows saveFile errors and resets saving flag', async () => {
    const documentStore = useDocumentStore()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await documentStore.openFile('/workspace/doc.md', '# test', 'doc.md')
    documentStore.updateContent('# changed')

    documentStoragePortMock.saveMarkdownFile.mockRejectedValue(new Error('save failed'))

    await expect(documentStore.saveFile()).rejects.toThrow('save failed')
    expect(documentStore.isSaving).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save file:', expect.any(Error))
  })

  it('saves all dirty files and clears matching external change state', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [
      makeDocument({ id: 'doc-1', content: 'a-new', savedContent: 'a-old', isDirty: true }),
      makeDocument({ id: 'doc-2', path: '/workspace/b.md', name: 'b.md', content: 'b-new', savedContent: 'b-old', isDirty: true }),
    ]
    documentStore.externalChange = {
      documentId: 'doc-1',
      path: '/workspace/doc.md',
      diskContent: '# stale',
      detectedAt: Date.now(),
    }
    documentStore.ignoredExternalChanges = {
      '/workspace/doc.md': '# stale',
      '/workspace/b.md': '# stale-b',
    }

    documentStoragePortMock.saveMarkdownFile.mockResolvedValue(undefined)

    const saved = await documentStore.saveAllFiles()

    expect(saved).toBe(true)
    expect(documentStore.externalChange).toBeNull()
    expect(documentStore.ignoredExternalChanges['/workspace/doc.md']).toBeUndefined()
    expect(documentStore.ignoredExternalChanges['/workspace/b.md']).toBeUndefined()
    expect(typeof documentStore.lastSaveTime).toBe('number')
  })

  it('handles non-sentinel open dialog errors by logging and returning false', async () => {
    const documentStore = useDocumentStore()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    documentStoragePortMock.openMarkdownFile.mockRejectedValue(new Error('dialog failure'))

    const opened = await documentStore.openFileDialog()

    expect(opened).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to open file:', expect.any(Error))
  })

  it('returns false from accept/keep external change when no alert exists', () => {
    const documentStore = useDocumentStore()

    expect(documentStore.acceptExternalChange()).toBe(false)
    expect(documentStore.keepLocalVersion()).toBe(false)
  })

  it('handles acceptExternalChange when target document no longer exists', () => {
    const documentStore = useDocumentStore()
    documentStore.externalChange = {
      documentId: 'missing-doc',
      path: '/workspace/missing.md',
      diskContent: '# disk',
      detectedAt: Date.now(),
    }

    expect(documentStore.acceptExternalChange()).toBe(false)
    expect(documentStore.externalChange).toBeNull()
  })

  it('applies remote changes only when content actually changes', async () => {
    const documentStore = useDocumentStore()
    await documentStore.openFile('/workspace/live.md', '# initial', 'live.md')

    expect(documentStore.applyRemoteChange('/workspace/missing.md', '# x')).toBe(false)
    expect(documentStore.applyRemoteChange('/workspace/live.md', '# initial')).toBe(false)
    expect(documentStore.applyRemoteChange('/workspace/live.md', '# remote')).toBe(true)
    expect(documentStore.activeDocument?.content).toBe('# remote')
    expect(documentStore.activeDocument?.isDirty).toBe(false)
  })

  it('loads and saves recent files with malformed-storage fallback and reset cleanup', () => {
    const documentStore = useDocumentStore()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    localStorage.setItem('kea-recent-files', 'not-json')
    documentStore.loadRecentFiles()
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load recent files:', expect.any(Error))

    documentStore.recentFiles = [{ path: '/workspace/a.md', name: 'a.md', lastOpened: Date.now() }]
    documentStore.saveRecentFiles()
    expect(localStorage.getItem('kea-recent-files')).toBeTruthy()

    documentStore.reset()
    expect(documentStore.openDocuments).toEqual([])
    expect(documentStore.activeDocumentId).toBeNull()
    expect(documentStore.editorMode).toBe('source')
  })

  it('reorders tabs and resolves tab indexes', () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [
      makeDocument({ id: 'doc-1', name: 'one.md' }),
      makeDocument({ id: 'doc-2', path: '/workspace/two.md', name: 'two.md' }),
      makeDocument({ id: 'doc-3', path: '/workspace/three.md', name: 'three.md' }),
    ]

    expect(documentStore.getDocumentIndex('doc-2')).toBe(1)

    documentStore.reorderTabs(2, 0)

    expect(documentStore.openDocuments.map(doc => doc.id)).toEqual(['doc-3', 'doc-1', 'doc-2'])
    expect(documentStore.getDocumentIndex('doc-3')).toBe(0)
  })

  it('deduplicates recent files when rename causes path collisions', () => {
    const documentStore = useDocumentStore()
    documentStore.recentFiles = [
      { path: '/workspace/notes/plan.md', name: 'plan.md', lastOpened: 1 },
      { path: '/workspace/archive/plan.md', name: 'plan.md', lastOpened: 2 },
    ]

    documentStore.updatePathsAfterRename('/workspace/notes', '/workspace/archive', true)

    expect(documentStore.recentFiles).toHaveLength(1)
    expect(documentStore.recentFiles[0].path).toBe('/workspace/archive/plan.md')
  })

  it('clears matching external change metadata when applying remote edits', async () => {
    const documentStore = useDocumentStore()
    await documentStore.openFile('/workspace/live.md', '# old', 'live.md')
    documentStore.externalChange = {
      documentId: documentStore.activeDocumentId as string,
      path: '/workspace/live.md',
      diskContent: '# stale',
      detectedAt: Date.now(),
    }

    const changed = documentStore.applyRemoteChange('/workspace/live.md', '# remote')

    expect(changed).toBe(true)
    expect(documentStore.externalChange).toBeNull()
  })

  it('logs errors when saving recent files fails', () => {
    const documentStore = useDocumentStore()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    documentStore.recentFiles = [{ path: '/workspace/a.md', name: 'a.md', lastOpened: Date.now() }]
    documentStore.saveRecentFiles()

    expect(setItemSpy).toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save recent files:', expect.any(Error))
  })
})
