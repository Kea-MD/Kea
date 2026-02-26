import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenDocument } from '../../src/modules/editor/state/documentStore'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'
import EditorTabs from '../../src/modules/editor/ui/EditorTabs.vue'

function makeTab(id: string, name: string): OpenDocument {
  return {
    id,
    path: `/workspace/${name}`,
    name,
    content: '# test',
    savedContent: '# test',
    isDirty: false,
  }
}

describe('EditorTabs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('switches tabs and triggers new/close actions', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [makeTab('tab-1', 'first.md'), makeTab('tab-2', 'second.md')]
    documentStore.activeDocumentId = 'tab-1'

    const closeSpy = vi.spyOn(documentStore, 'closeDocument').mockResolvedValue(true)
    const newFileSpy = vi.spyOn(documentStore, 'newFile').mockReturnValue('tab-3')

    const wrapper = mount(EditorTabs)

    await wrapper.findAll('.tab')[1].trigger('click')
    expect(documentStore.activeDocumentId).toBe('tab-2')

    await wrapper.findAll('.close-btn')[0].trigger('click')
    expect(closeSpy).toHaveBeenCalledWith('tab-1')

    await wrapper.get('button[title="New document"]').trigger('click')
    expect(newFileSpy).toHaveBeenCalledTimes(1)
  })

  it('closes a tab on middle mouse click', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [makeTab('tab-1', 'first.md')]
    documentStore.activeDocumentId = 'tab-1'

    const closeSpy = vi.spyOn(documentStore, 'closeDocument').mockResolvedValue(true)
    const wrapper = mount(EditorTabs)

    await wrapper.get('.tab').trigger('mousedown', { button: 1 })

    expect(closeSpy).toHaveBeenCalledWith('tab-1')
  })
})
