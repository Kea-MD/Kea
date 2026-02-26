import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorAppActions } from '../../src/app/runtime/useEditorAppActions'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'
import { useSettingsStore } from '../../src/modules/settings/state/settingsStore'
import { useWorkspaceStore } from '../../src/modules/workspace/state/workspaceStore'

const listenMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}))

describe('useEditorAppActions keyboard shortcuts', () => {
  function mountHarness(toggleSidebar = vi.fn()) {
    const Harness = defineComponent({
      setup() {
        return useEditorAppActions({
          toggleSidebar,
        })
      },
      template: '<div />',
    })

    const wrapper = mount(Harness)
    return { wrapper, toggleSidebar }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    listenMock.mockResolvedValue(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('triggers keydown shortcuts for file/view/editor actions', async () => {
    const documentStore = useDocumentStore()
    const editorCommandListener = vi.fn()
    window.addEventListener('kea-editor-command', editorCommandListener as EventListener)

    const { wrapper, toggleSidebar } = mountHarness()
    await nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '\\', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))
    await nextTick()

    expect(documentStore.openDocuments).toHaveLength(1)
    expect((wrapper.vm as unknown as { showQuickSwitcher: boolean }).showQuickSwitcher).toBe(true)
    expect((wrapper.vm as unknown as { showSettingsDialog: boolean }).showSettingsDialog).toBe(true)
    expect(toggleSidebar).toHaveBeenCalledTimes(1)
    expect(editorCommandListener).toHaveBeenCalled()

    wrapper.unmount()
    window.removeEventListener('kea-editor-command', editorCommandListener as EventListener)
  })

  it('ignores global shortcuts while shortcut capture mode is active', async () => {
    const documentStore = useDocumentStore()
    const settingsStore = useSettingsStore()
    const { wrapper } = mountHarness()
    await nextTick()

    settingsStore.setShortcutCaptureActive(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }))
    await nextTick()

    expect(documentStore.openDocuments).toHaveLength(0)

    wrapper.unmount()
  })

  it('handles menu actions and runs appropriate store operations', async () => {
    let menuHandler: unknown = null
    listenMock.mockImplementation(async (_eventName: string, handler: unknown) => {
      menuHandler = handler
      return vi.fn()
    })

    const emitMenuAction = (payload: string) => {
      const handler = menuHandler as ((event: { payload: string }) => void) | null
      if (handler) {
        handler({ payload })
      }
    }

    const documentStore = useDocumentStore()
    const workspaceStore = useWorkspaceStore()
    documentStore.openDocuments = [
      {
        id: 'doc-1',
        path: '/workspace/one.md',
        name: 'one.md',
        content: '# one',
        savedContent: '# one',
        isDirty: false,
      },
    ]
    documentStore.activeDocumentId = 'doc-1'

    const openFileSpy = vi.spyOn(documentStore, 'openFileDialog').mockResolvedValue(true)
    const openFolderSpy = vi.spyOn(workspaceStore, 'openFolder').mockResolvedValue(true)
    const saveSpy = vi.spyOn(documentStore, 'saveFile').mockResolvedValue(true)
    const saveAsSpy = vi.spyOn(documentStore, 'saveFileAs').mockResolvedValue(true)
    const closeSpy = vi.spyOn(documentStore, 'closeDocument').mockResolvedValue(true)
    const toggleModeSpy = vi.spyOn(documentStore, 'toggleEditorMode')

    const openDocumentsBeforeUnknown = documentStore.openDocuments.length

    const { wrapper } = mountHarness()
    await nextTick()

    emitMenuAction('open_file')
    emitMenuAction('open_folder')
    emitMenuAction('save')
    emitMenuAction('save_as')
    emitMenuAction('close_tab')
    emitMenuAction('quick_open')
    emitMenuAction('open_settings')
    emitMenuAction('toggle_editor_mode')
    emitMenuAction('unknown_action')
    await nextTick()

    expect(openFileSpy).toHaveBeenCalledTimes(1)
    expect(openFolderSpy).toHaveBeenCalledTimes(1)
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(saveAsSpy).toHaveBeenCalledTimes(1)
    expect(closeSpy).toHaveBeenCalledWith('doc-1')
    expect(toggleModeSpy).toHaveBeenCalledTimes(1)
    expect((wrapper.vm as unknown as { showQuickSwitcher: boolean }).showQuickSwitcher).toBe(true)
    expect((wrapper.vm as unknown as { showSettingsDialog: boolean }).showSettingsDialog).toBe(true)
    expect(documentStore.openDocuments).toHaveLength(openDocumentsBeforeUnknown)

    wrapper.unmount()
  })

  it('loads recent files on mount and detaches listeners on unmount', async () => {
    const unlistenMenu = vi.fn()
    listenMock.mockResolvedValue(unlistenMenu)

    const documentStore = useDocumentStore()
    const loadRecentFilesSpy = vi.spyOn(documentStore, 'loadRecentFiles')

    const { wrapper } = mountHarness()
    await nextTick()

    expect(loadRecentFilesSpy).toHaveBeenCalledTimes(1)

    wrapper.unmount()

    expect(unlistenMenu).toHaveBeenCalledTimes(1)

    const openedBefore = documentStore.openDocuments.length
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }))
    await nextTick()

    expect(documentStore.openDocuments).toHaveLength(openedBefore)
  })

  it('exposes toolbar/app handlers for command, mode, and dialog state', async () => {
    const documentStore = useDocumentStore()
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const editorCommandListener = vi.fn()
    window.addEventListener('kea-editor-command', editorCommandListener as EventListener)

    const { wrapper } = mountHarness()
    await nextTick()

    const vm = wrapper.vm as unknown as {
      showQuickSwitcher: boolean
      showSettingsDialog: boolean
      handleNewRequest: () => void
      handleFeedback: () => void
      handleSettings: () => void
      handleEditorCommand: (command: 'find') => void
      handleEditorMode: (mode: 'source' | 'rendered') => void
      closeQuickSwitcher: () => void
      closeSettings: () => void
    }

    vm.handleNewRequest()
    expect(documentStore.openDocuments).toHaveLength(1)

    vm.handleFeedback()
    expect(consoleLogSpy).toHaveBeenCalledWith('Feedback')

    vm.handleSettings()
    expect(vm.showSettingsDialog).toBe(true)
    vm.closeSettings()
    expect(vm.showSettingsDialog).toBe(false)

    vm.handleEditorCommand('find')
    expect(editorCommandListener).toHaveBeenCalled()

    vm.handleEditorMode('source')
    expect(documentStore.editorMode).toBe('source')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }))
    await nextTick()
    expect(vm.showQuickSwitcher).toBe(true)
    vm.closeQuickSwitcher()
    expect(vm.showQuickSwitcher).toBe(false)

    wrapper.unmount()
    window.removeEventListener('kea-editor-command', editorCommandListener as EventListener)
  })
})
