import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('reorders tabs while dragging', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [makeTab('tab-1', 'first.md'), makeTab('tab-2', 'second.md')]
    documentStore.activeDocumentId = 'tab-1'

    const reorderSpy = vi.spyOn(documentStore, 'reorderTabs')
    const wrapper = mount(EditorTabs)
    const tabs = wrapper.findAll('.tab')

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      writable: true,
      value: vi.fn(() => tabs[1].element),
    })

    await tabs[0].trigger('mousedown', { button: 0, clientX: 20, clientY: 20 })

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 40,
    }))

    document.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 40,
    }))

    await wrapper.vm.$nextTick()

    expect(reorderSpy).toHaveBeenCalledWith(0, 1)
    expect(documentStore.openDocuments.map(doc => doc.id)).toEqual(['tab-2', 'tab-1'])
  })
})
