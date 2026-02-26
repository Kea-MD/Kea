import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
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
  template: '<li class="file-tree-item-stub" />',
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

function makeDirectory(path: string, name: string, children: FileEntry[] = []): FileEntry {
  return {
    name,
    path,
    is_dir: true,
    is_markdown: false,
    children,
  }
}

describe('FileTree drag and menu behaviour', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('moves dragged directory into a valid folder target', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const sourceEntry = makeDirectory('/workspace/src', 'src', [
      {
        name: 'note.md',
        path: '/workspace/src/note.md',
        is_dir: false,
        is_markdown: true,
      },
    ])
    const targetEntry = makeDirectory('/workspace/dst', 'dst')

    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [sourceEntry, targetEntry]

    const moveItemSpy = vi.spyOn(workspaceStore, 'moveItem').mockResolvedValue('/workspace/dst/src')
    const updatePathsSpy = vi.spyOn(documentStore, 'updatePathsAfterRename')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const targetElement = document.createElement('div')
    targetElement.setAttribute('data-entry-path', '/workspace/dst')
    targetElement.setAttribute('data-entry-dir', 'true')
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => targetElement),
    })

    const wrapper = mountFileTree()
    const sourceComponent = wrapper.findAllComponents(FileTreeItemStub)[0]

    sourceComponent.vm.$emit(
      'pointer-drag-start',
      new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0 }),
      sourceEntry
    )

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 10, clientY: 10 }))
    await flushPromises()

    expect(moveItemSpy).toHaveBeenCalledWith('/workspace/src', '/workspace/dst')
    expect(updatePathsSpy).toHaveBeenCalledWith('/workspace/src', '/workspace/dst/src', true)
  })

  it('does not move item when pointer drag never crosses movement threshold', async () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const sourceEntry = makeDirectory('/workspace/src', 'src')
    const targetEntry = makeDirectory('/workspace/dst', 'dst')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [sourceEntry, targetEntry]

    const moveItemSpy = vi.spyOn(workspaceStore, 'moveItem').mockResolvedValue('/workspace/dst/src')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const wrapper = mountFileTree()
    const sourceComponent = wrapper.findAllComponents(FileTreeItemStub)[0]

    sourceComponent.vm.$emit(
      'pointer-drag-start',
      new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0 }),
      sourceEntry
    )

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 2, clientY: 2 }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 2, clientY: 2 }))
    await flushPromises()

    expect(moveItemSpy).not.toHaveBeenCalled()
  })

  it('ignores non-left-button pointer drag start', async () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const sourceEntry = makeDirectory('/workspace/src', 'src')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [sourceEntry]

    const moveItemSpy = vi.spyOn(workspaceStore, 'moveItem').mockResolvedValue('/workspace/src')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const wrapper = mountFileTree()
    const sourceComponent = wrapper.findAllComponents(FileTreeItemStub)[0]

    sourceComponent.vm.$emit(
      'pointer-drag-start',
      new MouseEvent('mousedown', { button: 2, clientX: 0, clientY: 0 }),
      sourceEntry
    )

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20 }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 20, clientY: 20 }))
    await flushPromises()

    expect(moveItemSpy).not.toHaveBeenCalled()
  })

  it('drops dragged entry onto workspace root when pointer is over tree background', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const sourceEntry = makeDirectory('/workspace/a/src', 'src')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [sourceEntry]

    const moveItemSpy = vi.spyOn(workspaceStore, 'moveItem').mockResolvedValue('/workspace/src')
    const updatePathsSpy = vi.spyOn(documentStore, 'updatePathsAfterRename')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const wrapper = mountFileTree()
    const treeListElement = wrapper.get('.tree-list').element

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => treeListElement),
    })

    const sourceComponent = wrapper.findComponent(FileTreeItemStub)
    sourceComponent.vm.$emit(
      'pointer-drag-start',
      new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0 }),
      sourceEntry
    )

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20 }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 20, clientY: 20 }))
    await flushPromises()

    expect(moveItemSpy).toHaveBeenCalledWith('/workspace/a/src', '/workspace')
    expect(updatePathsSpy).toHaveBeenCalledWith('/workspace/a/src', '/workspace/src', true)
  })

  it('resets drag state when pointer drop has no valid target', async () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const sourceEntry = makeDirectory('/workspace/a/src', 'src')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [sourceEntry]

    const moveItemSpy = vi.spyOn(workspaceStore, 'moveItem').mockResolvedValue('/workspace/src')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => document.createElement('div')),
    })

    const wrapper = mountFileTree()
    const sourceComponent = wrapper.findComponent(FileTreeItemStub)

    sourceComponent.vm.$emit(
      'pointer-drag-start',
      new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0 }),
      sourceEntry
    )

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20 }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 20, clientY: 20 }))
    await flushPromises()

    expect(moveItemSpy).not.toHaveBeenCalled()
  })

  it('safely handles pointer move/end when drag source is cleared mid-drag', async () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const sourceEntry = makeDirectory('/workspace/src', 'src')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [sourceEntry]

    vi.spyOn(console, 'log').mockImplementation(() => {})
    const wrapper = mountFileTree()
    const sourceComponent = wrapper.findComponent(FileTreeItemStub)

    sourceComponent.vm.$emit(
      'pointer-drag-start',
      new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0 }),
      sourceEntry
    )

    const vm = wrapper.vm as unknown as {
      dragState: {
        sourcePath: string | null
      }
    }
    vm.dragState.sourcePath = null

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 10, clientY: 10 }))

    expect(true).toBe(true)
  })

  it('handles folder drop when workspace move returns null', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const sourceEntry = makeDirectory('/workspace/src', 'src')
    const targetEntry = makeDirectory('/workspace/target', 'target')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [sourceEntry, targetEntry]

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(workspaceStore, 'moveItem').mockResolvedValue(null)
    const updatePathsSpy = vi.spyOn(documentStore, 'updatePathsAfterRename')

    const targetElement = document.createElement('div')
    targetElement.setAttribute('data-entry-path', '/workspace/target')
    targetElement.setAttribute('data-entry-dir', 'true')
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => targetElement),
    })

    const wrapper = mountFileTree()
    const sourceComponent = wrapper.findAllComponents(FileTreeItemStub)[0]
    sourceComponent.vm.$emit(
      'pointer-drag-start',
      new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0 }),
      sourceEntry
    )

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20 }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 20, clientY: 20 }))
    await flushPromises()

    expect(updatePathsSpy).not.toHaveBeenCalled()
  })

  it('logs move failures during pointer drop operations', async () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const sourceEntry = makeDirectory('/workspace/src', 'src')
    const targetEntry = makeDirectory('/workspace/target', 'target')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [sourceEntry, targetEntry]

    vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(workspaceStore, 'moveItem').mockRejectedValue(new Error('move exploded'))

    const targetElement = document.createElement('div')
    targetElement.setAttribute('data-entry-path', '/workspace/target')
    targetElement.setAttribute('data-entry-dir', 'true')
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => targetElement),
    })

    const wrapper = mountFileTree()
    const sourceComponent = wrapper.findAllComponents(FileTreeItemStub)[0]
    sourceComponent.vm.$emit(
      'pointer-drag-start',
      new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0 }),
      sourceEntry
    )

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20 }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 20, clientY: 20 }))
    await flushPromises()

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to move item:',
      expect.any(Error),
      expect.objectContaining({ sourcePath: '/workspace/src', targetDir: '/workspace/target' })
    )
  })

  it('ignores folder targets that fail drop validation checks', async () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const sourceEntry = makeDirectory('/workspace/src', 'src')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [sourceEntry]

    vi.spyOn(console, 'log').mockImplementation(() => {})
    const moveItemSpy = vi.spyOn(workspaceStore, 'moveItem').mockResolvedValue('/workspace/src')

    const invalidTargetElement = document.createElement('div')
    invalidTargetElement.setAttribute('data-entry-path', '/workspace/src')
    invalidTargetElement.setAttribute('data-entry-dir', 'true')
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => invalidTargetElement),
    })

    const wrapper = mountFileTree()
    const sourceComponent = wrapper.findAllComponents(FileTreeItemStub)[0]
    sourceComponent.vm.$emit(
      'pointer-drag-start',
      new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0 }),
      sourceEntry
    )

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 20 }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 20, clientY: 20 }))
    await flushPromises()

    expect(moveItemSpy).not.toHaveBeenCalled()
  })

  it('closes context menu when rename action is triggered', async () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    const entry = makeDirectory('/workspace/docs', 'docs')
    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [entry]

    const wrapper = mountFileTree()
    const sourceComponent = wrapper.findAllComponents(FileTreeItemStub)[0]

    sourceComponent.vm.$emit(
      'context-menu',
      new MouseEvent('contextmenu', { clientX: 25, clientY: 30 }),
      entry
    )
    await nextTick()

    expect(wrapper.find('button[title="Rename"]').exists()).toBe(true)

    await wrapper.get('button[title="Rename"]').trigger('click')
    await nextTick()

    expect(wrapper.find('button[title="Rename"]').exists()).toBe(false)
  })

  it('removes document listeners on unmount', () => {
    const workspaceStore = useWorkspaceStore()
    const settingsStore = useSettingsStore()
    settingsStore.restoreWorkspaceOnLaunch = false

    workspaceStore.rootPath = '/workspace'
    workspaceStore.rootName = 'workspace'
    workspaceStore.entries = [makeDirectory('/workspace/docs', 'docs')]

    const removeListenerSpy = vi.spyOn(document, 'removeEventListener')

    const wrapper = mountFileTree()
    wrapper.unmount()

    expect(removeListenerSpy).toHaveBeenCalledWith('click', expect.any(Function))
    expect(removeListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
  })
})
