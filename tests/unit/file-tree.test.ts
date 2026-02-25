import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import FileTree from '../../src/modules/workspace/ui/FileTree.vue'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'
import { useSettingsStore } from '../../src/modules/settings/state/settingsStore'
import { useWorkspaceStore } from '../../src/modules/workspace/state/workspaceStore'

const FileTreeItemStub = defineComponent({
  name: 'FileTreeItemStub',
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

describe('FileTree workspace actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('runs new/open/save actions from header controls', async () => {
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
        isDirty: false,
      },
    ]
    documentStore.activeDocumentId = 'doc-1'
    documentStore.isSaving = false

    const newFileSpy = vi.spyOn(documentStore, 'newFile').mockReturnValue('doc-2')
    const openFileDialogSpy = vi.spyOn(documentStore, 'openFileDialog').mockResolvedValue(true)
    const openFolderSpy = vi.spyOn(workspaceStore, 'openFolder').mockResolvedValue(true)
    const saveFileSpy = vi.spyOn(documentStore, 'saveFile').mockResolvedValue(true)

    const wrapper = mountFileTree()

    await wrapper.get('button[title="New File (⌘N)"]').trigger('click')
    await wrapper.get('button[title="Open File (⌘O)"]').trigger('click')
    await wrapper.get('button[title="Open Folder (⌘⇧O)"]').trigger('click')
    await wrapper.get('button[title="Save (⌘S)"]').trigger('click')

    expect(newFileSpy).toHaveBeenCalledTimes(1)
    expect(openFileDialogSpy).toHaveBeenCalledTimes(1)
    expect(openFolderSpy).toHaveBeenCalledTimes(1)
    expect(saveFileSpy).toHaveBeenCalledTimes(1)
  })

  it('uses save as when the active document has no path', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()
    const settingsStore = useSettingsStore()

    settingsStore.restoreWorkspaceOnLaunch = false
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = []

    documentStore.openDocuments = [
      {
        id: 'doc-untitled',
        path: '',
        name: 'Untitled',
        content: '',
        savedContent: '',
        isDirty: false,
      },
    ]
    documentStore.activeDocumentId = 'doc-untitled'
    documentStore.isSaving = false

    const saveFileSpy = vi.spyOn(documentStore, 'saveFile').mockResolvedValue(true)
    const saveFileAsSpy = vi.spyOn(documentStore, 'saveFileAs').mockResolvedValue(true)

    const wrapper = mountFileTree()
    await wrapper.get('button[title="Save (⌘S)"]').trigger('click')

    expect(saveFileAsSpy).toHaveBeenCalledTimes(1)
    expect(saveFileSpy).not.toHaveBeenCalled()
  })
})
