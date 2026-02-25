import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'

describe('documentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('creates a new document and marks it dirty when content changes', () => {
    const documentStore = useDocumentStore()
    const id = documentStore.newFile()

    expect(documentStore.activeDocumentId).toBe(id)
    expect(documentStore.activeDocument?.isDirty).toBe(false)

    documentStore.updateContent('# Hello Kea')

    expect(documentStore.activeDocument?.isDirty).toBe(true)
    expect(documentStore.activeDocument?.content).toBe('# Hello Kea')
  })

  it('closes the active tab and activates an adjacent tab', async () => {
    const documentStore = useDocumentStore()
    const firstId = documentStore.newFile()
    const secondId = documentStore.newFile()

    expect(documentStore.activeDocumentId).toBe(secondId)

    const closed = await documentStore.closeDocument(secondId, true)

    expect(closed).toBe(true)
    expect(documentStore.activeDocumentId).toBe(firstId)
  })

  it('updates affected paths after directory rename', () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [
      {
        id: 'doc-1',
        path: '/workspace/notes/plan.md',
        name: 'plan.md',
        content: 'content',
        savedContent: 'content',
        isDirty: false,
      },
      {
        id: 'doc-2',
        path: '/workspace/other.md',
        name: 'other.md',
        content: 'content',
        savedContent: 'content',
        isDirty: false,
      },
    ]
    documentStore.externalChange = {
      documentId: 'doc-1',
      path: '/workspace/notes/plan.md',
      diskContent: 'new-content',
      detectedAt: Date.now(),
    }
    documentStore.ignoredExternalChanges = {
      '/workspace/notes/plan.md': 'new-content',
    }
    documentStore.recentFiles = [
      { path: '/workspace/notes/plan.md', name: 'plan.md', lastOpened: Date.now() },
    ]

    documentStore.updatePathsAfterRename('/workspace/notes', '/workspace/archive', true)

    expect(documentStore.openDocuments[0].path).toBe('/workspace/archive/plan.md')
    expect(documentStore.openDocuments[1].path).toBe('/workspace/other.md')
    expect(documentStore.externalChange?.path).toBe('/workspace/archive/plan.md')
    expect(documentStore.ignoredExternalChanges['/workspace/archive/plan.md']).toBe('new-content')
    expect(documentStore.recentFiles[0].path).toBe('/workspace/archive/plan.md')
  })

  it('keeps recent files unique and capped at ten', () => {
    const documentStore = useDocumentStore()

    for (let i = 0; i < 11; i += 1) {
      documentStore.addToRecentFiles(`/workspace/doc-${i}.md`, `doc-${i}.md`)
    }

    documentStore.addToRecentFiles('/workspace/doc-5.md', 'doc-5.md')

    expect(documentStore.recentFiles).toHaveLength(10)
    expect(documentStore.recentFiles[0].path).toBe('/workspace/doc-5.md')
    expect(documentStore.recentFiles.filter(file => file.path === '/workspace/doc-5.md')).toHaveLength(1)
  })
})
