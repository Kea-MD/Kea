import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatShortcutForDisplay } from '../../src/modules/settings/shortcuts/shortcutRegistry'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'
import { useSettingsStore } from '../../src/modules/settings/state/settingsStore'
import { useWorkspaceStore } from '../../src/modules/workspace/state/workspaceStore'
import EditorEmptyState from '../../src/modules/editor/ui/EditorEmptyState.vue'

describe('EditorEmptyState', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('runs open-folder/open-file/new-file actions', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()

    const openFolderSpy = vi.spyOn(workspaceStore, 'openFolder').mockResolvedValue(true)
    const openFileSpy = vi.spyOn(documentStore, 'openFileDialog').mockResolvedValue(true)
    const newFileSpy = vi.spyOn(documentStore, 'newFile').mockReturnValue('doc-1')

    const wrapper = mount(EditorEmptyState)

    await wrapper.get('button[title="Open Folder"]').trigger('click')
    await wrapper.get('button[title="Open File"]').trigger('click')
    await wrapper.get('button[title="New File"]').trigger('click')

    expect(openFolderSpy).toHaveBeenCalledTimes(1)
    expect(openFileSpy).toHaveBeenCalledTimes(1)
    expect(newFileSpy).toHaveBeenCalledTimes(1)
  })

  it('renders shortcut hints from settings', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.setShortcut('open_folder', 'Alt+O')
    settingsStore.setShortcut('open_file', 'Alt+F')
    settingsStore.setShortcut('new_file', 'Alt+N')

    const wrapper = mount(EditorEmptyState)

    const isMacPlatform = navigator.platform.toUpperCase().includes('MAC')
    expect(wrapper.text()).toContain(formatShortcutForDisplay(settingsStore.shortcuts.open_folder, isMacPlatform))
    expect(wrapper.text()).toContain(formatShortcutForDisplay(settingsStore.shortcuts.open_file, isMacPlatform))
    expect(wrapper.text()).toContain(formatShortcutForDisplay(settingsStore.shortcuts.new_file, isMacPlatform))
  })
})
