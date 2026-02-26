import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'
import ExternalChangeBanner from '../../src/modules/editor/ui/ExternalChangeBanner.vue'

describe('ExternalChangeBanner', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('renders when external changes exist and triggers resolve actions', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [
      {
        id: 'doc-1',
        path: '/workspace/notes.md',
        name: 'notes.md',
        content: '# local',
        savedContent: '# local',
        isDirty: true,
      },
    ]
    documentStore.activeDocumentId = 'doc-1'
    documentStore.externalChange = {
      documentId: 'doc-1',
      path: '/workspace/notes.md',
      diskContent: '# disk',
      detectedAt: Date.now(),
    }

    const keepSpy = vi.spyOn(documentStore, 'keepLocalVersion').mockReturnValue(true)
    const acceptSpy = vi.spyOn(documentStore, 'acceptExternalChange').mockReturnValue(true)

    const wrapper = mount(ExternalChangeBanner)

    expect(wrapper.text()).toContain('notes.md')

    await wrapper.get('button[title="Keep local"]').trigger('click')
    await wrapper.get('button[title="Reload disk"]').trigger('click')

    expect(keepSpy).toHaveBeenCalledTimes(1)
    expect(acceptSpy).toHaveBeenCalledTimes(1)
  })

  it('does not render when no external changes are present', () => {
    const wrapper = mount(ExternalChangeBanner)
    expect(wrapper.find('.external-change-banner').exists()).toBe(false)
  })

  it('handles empty external-change path fallback text', () => {
    const documentStore = useDocumentStore()
    documentStore.externalChange = {
      documentId: 'doc-1',
      path: '',
      diskContent: '# disk',
      detectedAt: Date.now(),
    }

    const wrapper = mount(ExternalChangeBanner)
    expect(wrapper.text()).toContain('changed on disk.')
  })
})
