import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentStoragePortMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  openMarkdownFile: vi.fn(),
  saveMarkdownFile: vi.fn(),
  saveMarkdownFileAs: vi.fn(),
}))

vi.mock('../../src/platform/tauri/documentStorage', () => ({
  tauriDocumentStoragePort: documentStoragePortMock,
}))

import { useDocumentStore } from '../../src/modules/editor/state/documentStore'

describe('documentStore actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('opens markdown file from dialog and sets active document', async () => {
    documentStoragePortMock.openMarkdownFile.mockResolvedValue({
      path: '/workspace/note.md',
      name: 'note.md',
      content: '# note',
    })

    const documentStore = useDocumentStore()
    const opened = await documentStore.openFileDialog()

    expect(opened).toBe(true)
    expect(documentStore.openDocuments).toHaveLength(1)
    expect(documentStore.activeDocument?.path).toBe('/workspace/note.md')
  })

  it('saves active file and clears dirty state', async () => {
    documentStoragePortMock.saveMarkdownFile.mockResolvedValue(undefined)

    const documentStore = useDocumentStore()
    await documentStore.openFile('/workspace/note.md', '# note', 'note.md')
    documentStore.updateContent('# changed')

    const saved = await documentStore.saveFile()

    expect(saved).toBe(true)
    expect(documentStoragePortMock.saveMarkdownFile).toHaveBeenCalledWith('/workspace/note.md', '# changed')
    expect(documentStore.activeDocument?.isDirty).toBe(false)
    expect(documentStore.activeDocument?.savedContent).toBe('# changed')
    expect(typeof documentStore.lastSaveTime).toBe('number')
  })

  it('saves untitled documents through save-as flow', async () => {
    documentStoragePortMock.saveMarkdownFileAs.mockResolvedValue({
      path: '/workspace/new-note.md',
      name: 'new-note.md',
    })

    const documentStore = useDocumentStore()
    documentStore.newFile()
    documentStore.updateContent('new file content')

    const saved = await documentStore.saveFile()

    expect(saved).toBe(true)
    expect(documentStoragePortMock.saveMarkdownFileAs).toHaveBeenCalledWith('new file content')
    expect(documentStore.activeDocument?.path).toBe('/workspace/new-note.md')
    expect(documentStore.activeDocument?.name).toBe('new-note.md')
  })

  it('detects external changes for dirty documents and supports apply/keep actions', async () => {
    documentStoragePortMock.readFile.mockResolvedValue({
      path: '/workspace/note.md',
      name: 'note.md',
      content: '# disk version',
    })

    const documentStore = useDocumentStore()
    await documentStore.openFile('/workspace/note.md', '# local version', 'note.md')
    documentStore.updateContent('# local changed')

    await documentStore.checkActiveDocumentExternalChange()

    expect(documentStore.hasExternalChange).toBe(true)
    expect(documentStore.externalChange?.diskContent).toBe('# disk version')

    const kept = documentStore.keepLocalVersion()
    expect(kept).toBe(true)
    expect(documentStore.hasExternalChange).toBe(false)
    expect(documentStore.ignoredExternalChanges['/workspace/note.md']).toBe('# disk version')

    documentStore.externalChange = {
      documentId: documentStore.activeDocumentId as string,
      path: '/workspace/note.md',
      diskContent: '# applied disk version',
      detectedAt: Date.now(),
    }

    const applied = documentStore.acceptExternalChange()

    expect(applied).toBe(true)
    expect(documentStore.activeDocument?.content).toBe('# applied disk version')
    expect(documentStore.activeDocument?.savedContent).toBe('# applied disk version')
    expect(documentStore.activeDocument?.isDirty).toBe(false)
  })

  it('reuses existing tab when opening an already-open path', async () => {
    const documentStore = useDocumentStore()
    const firstId = await documentStore.openFile('/workspace/readme.md', '# readme', 'readme.md')

    const secondId = await documentStore.openFileFromPath('/workspace/readme.md')

    expect(secondId).toBe(firstId)
    expect(documentStoragePortMock.readFile).not.toHaveBeenCalled()
    expect(documentStore.openDocuments).toHaveLength(1)
  })
})
