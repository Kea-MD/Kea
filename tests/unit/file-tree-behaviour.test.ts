import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import type { OpenDocument } from '../../src/modules/editor/state/documentStore'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'
import { useSettingsStore } from '../../src/modules/settings/state/settingsStore'
import type { FileEntry } from '../../src/modules/workspace/state/workspaceStore'
import { useWorkspaceStore } from '../../src/modules/workspace/state/workspaceStore'
import FileTree from '../../src/modules/workspace/ui/FileTree.vue'

const FileTreeItemStub = defineComponent({
  name: 'FileTreeItem',
  props: {
    entry: {
      type: Object,
      required: true,
    },
  },
  emits: ['click', 'context-menu', 'toggle', 'pointer-drag-start'],
  template: '<li class="file-tree-item-stub"></li>',
})

function mountFileTree() {
  return mount(FileTree, {
    global: {
      stubs: {
        FileTreeItem: FileTreeItemStub,
        Teleport: true,
      },
    },
  })
}

function emitContextMenu(wrapper: ReturnType<typeof mountFileTree>, entry: FileEntry) {
  wrapper.getComponent(FileTreeItemStub).vm.$emit(
    'context-menu',
    new MouseEvent('contextmenu', { clientX: 32, clientY: 44 }),
    entry
  )
}

function makeDirectory(path: string, name: string, children: FileEntry[] = []): FileEntry {
  return {
    name,
    path,
    is_dir: true,
    is_markdown: false,
    children,
  }
}

describe('FileTree behaviour', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('restores workspace on mount when the setting is enabled', async () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()

    settingsStore.restoreWorkspaceOnLaunch = true

    const restoreWorkspaceSpy = vi.spyOn(workspaceStore, 'restoreWorkspace').mockResolvedValue(true)
    mountFileTree()
    await flushPromises()

    expect(restoreWorkspaceSpy).toHaveBeenCalledTimes(1)
  })

  it('logs open-file errors triggered from workspace actions', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()
    const settingsStore = useSettingsStore()

    settingsStore.restoreWorkspaceOnLaunch = false
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = []

    const error = new Error('open failed')
    vi.spyOn(documentStore, 'openFileDialog').mockRejectedValue(error)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountFileTree()
    await wrapper.get('button[title="Open File (⌘O)"]').trigger('click')
    await flushPromises()

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to open file:', error)
  })

  it('logs save errors triggered from workspace actions', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()
    const settingsStore = useSettingsStore()

    settingsStore.restoreWorkspaceOnLaunch = false
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = []

    documentStore.openDocuments = [
      {
        id: 'doc-1',
        path: '/workspace/note.md',
        name: 'note.md',
        content: '# note',
        savedContent: '# note',
        isDirty: true,
      },
    ]
    documentStore.activeDocumentId = 'doc-1'

    const error = new Error('save failed')
    vi.spyOn(documentStore, 'saveFile').mockRejectedValue(error)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountFileTree()
    await wrapper.get('button[title="Save (⌘S)"]').trigger('click')
    await flushPromises()

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save file:', error)
  })

  it('creates untitled file/folder from context menu actions', async () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const docsEntry = makeDirectory('/workspace/docs', 'docs', [
      {
        name: 'untitled.md',
        path: '/workspace/docs/untitled.md',
        is_dir: false,
        is_markdown: true,
      },
      makeDirectory('/workspace/docs/untitled', 'untitled'),
    ])

    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [docsEntry]

    const createFileSpy = vi.spyOn(workspaceStore, 'createFile').mockResolvedValue({
      name: 'untitled-1.md',
      path: '/workspace/docs/untitled-1.md',
      is_dir: false,
      is_markdown: true,
    })
    const createFolderSpy = vi.spyOn(workspaceStore, 'createFolder').mockResolvedValue(
      makeDirectory('/workspace/docs/untitled-1', 'untitled-1')
    )

    const wrapper = mountFileTree()

    emitContextMenu(wrapper, docsEntry)
    await nextTick()
    await wrapper.get('button[title="New File"]').trigger('click')
    await flushPromises()

    emitContextMenu(wrapper, docsEntry)
    await nextTick()
    await wrapper.get('button[title="New Folder"]').trigger('click')
    await flushPromises()

    expect(createFileSpy).toHaveBeenCalledWith('/workspace/docs', 'untitled-1.md')
    expect(createFolderSpy).toHaveBeenCalledWith('/workspace/docs', 'untitled-1')
  })

  it('deletes a folder and closes affected open documents after confirmation', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const folderEntry = makeDirectory('/workspace/docs', 'docs')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [folderEntry]

    documentStore.openDocuments = [
      {
        id: 'doc-1',
        path: '/workspace/docs/note.md',
        name: 'note.md',
        content: '# note',
        savedContent: '# note',
        isDirty: true,
      },
      {
        id: 'doc-2',
        path: '/workspace/other.md',
        name: 'other.md',
        content: '# other',
        savedContent: '# other',
        isDirty: false,
      },
    ] as OpenDocument[]

    const closeDocumentSpy = vi.spyOn(documentStore, 'closeDocument').mockResolvedValue(true)
    const deleteItemSpy = vi.spyOn(workspaceStore, 'deleteItem').mockResolvedValue(true)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mountFileTree()
    emitContextMenu(wrapper, folderEntry)
    await nextTick()

    await wrapper.get('button[title="Delete"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(closeDocumentSpy).toHaveBeenCalledWith('doc-1', true)
    expect(deleteItemSpy).toHaveBeenCalledWith('/workspace/docs')
  })

  it('does not delete when confirmation is cancelled', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const folderEntry = makeDirectory('/workspace/docs', 'docs')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [folderEntry]

    const closeDocumentSpy = vi.spyOn(documentStore, 'closeDocument').mockResolvedValue(true)
    const deleteItemSpy = vi.spyOn(workspaceStore, 'deleteItem').mockResolvedValue(true)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    const wrapper = mountFileTree()
    emitContextMenu(wrapper, folderEntry)
    await nextTick()

    await wrapper.get('button[title="Delete"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(closeDocumentSpy).not.toHaveBeenCalled()
    expect(deleteItemSpy).not.toHaveBeenCalled()
  })

  it('logs delete failures and still closes the context menu', async () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const fileEntry: FileEntry = {
      name: 'note.md',
      path: '/workspace/note.md',
      is_dir: false,
      is_markdown: true,
    }
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [fileEntry]

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(workspaceStore, 'deleteItem').mockRejectedValue(new Error('delete failed'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mountFileTree()
    emitContextMenu(wrapper, fileEntry)
    await nextTick()
    await wrapper.get('button[title="Delete"]').trigger('click')
    await flushPromises()

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete:', expect.any(Error))
    expect(wrapper.find('button[title="Delete"]').exists()).toBe(false)
  })

  it('closes context menu on outside document click', async () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const entry = makeDirectory('/workspace/docs', 'docs')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [entry]

    const wrapper = mountFileTree()
    emitContextMenu(wrapper, entry)
    await nextTick()
    expect(wrapper.find('button[title="Rename"]').exists()).toBe(true)

    document.dispatchEvent(new MouseEvent('click'))
    await nextTick()

    expect(wrapper.find('button[title="Rename"]').exists()).toBe(false)
  })
})
