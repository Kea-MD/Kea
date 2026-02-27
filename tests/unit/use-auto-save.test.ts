import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const documentStoragePortMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  openMarkdownFile: vi.fn(),
  saveMarkdownFile: vi.fn(),
  saveMarkdownFileAs: vi.fn(),
}))

vi.mock('../../src/platform/tauri/documentStorage', () => ({
  tauriDocumentStoragePort: documentStoragePortMock,
}))

import { useAutoSave } from '../../src/modules/editor/runtime/useAutoSave'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'

const Harness = defineComponent({
  props: {
    interval: {
      type: Number,
      default: 40,
    },
  },
  setup(props) {
    return useAutoSave(props.interval)
  },
  template: '<div />',
})

describe('useAutoSave', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('auto-saves dirty files with a path and resets status to idle', async () => {
    documentStoragePortMock.saveMarkdownFile.mockResolvedValue(undefined)
    const documentStore = useDocumentStore()
    await documentStore.openFile('/workspace/note.md', '# note', 'note.md')

    const wrapper = mount(Harness, {
      props: {
        interval: 40,
      },
    })

    documentStore.updateContent('# changed')

    await vi.advanceTimersByTimeAsync(50)

    const vm = wrapper.vm as unknown as {
      saveStatus: 'idle' | 'saving' | 'saved' | 'error'
      lastSaveError: string | null
    }

    expect(documentStoragePortMock.saveMarkdownFile).toHaveBeenCalledWith('/workspace/note.md', '# changed')
    expect(vm.saveStatus).toBe('saved')
    expect(vm.lastSaveError).toBeNull()
    expect(documentStore.activeDocument?.isDirty).toBe(false)

    await vi.advanceTimersByTimeAsync(2000)
    expect(vm.saveStatus).toBe('idle')

    wrapper.unmount()
  })

  it('surfaces save errors when auto-save fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    documentStoragePortMock.saveMarkdownFile.mockRejectedValue(new Error('disk full'))

    const documentStore = useDocumentStore()
    await documentStore.openFile('/workspace/note.md', '# note', 'note.md')

    const wrapper = mount(Harness, {
      props: {
        interval: 30,
      },
    })

    documentStore.updateContent('# changed')

    await vi.advanceTimersByTimeAsync(50)

    const vm = wrapper.vm as unknown as {
      saveStatus: 'idle' | 'saving' | 'saved' | 'error'
      lastSaveError: string | null
    }

    expect(vm.saveStatus).toBe('error')
    expect(vm.lastSaveError).toBe('disk full')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Auto-save failed:', expect.any(Error))

    wrapper.unmount()
  })

  it('does not auto-save untitled documents without a path', async () => {
    const documentStore = useDocumentStore()
    documentStore.newFile()

    const wrapper = mount(Harness, {
      props: {
        interval: 25,
      },
    })

    documentStore.updateContent('draft')

    await vi.advanceTimersByTimeAsync(100)

    const vm = wrapper.vm as unknown as {
      saveStatus: 'idle' | 'saving' | 'saved' | 'error'
    }

    expect(documentStoragePortMock.saveMarkdownFile).not.toHaveBeenCalled()
    expect(vm.saveStatus).toBe('idle')

    wrapper.unmount()
  })

  it('does not trigger auto-save when file content has not changed', async () => {
    documentStoragePortMock.saveMarkdownFile.mockResolvedValue(undefined)
    const documentStore = useDocumentStore()
    await documentStore.openFile('/workspace/stable.md', '# stable', 'stable.md')

    const wrapper = mount(Harness, {
      props: {
        interval: 25,
      },
    })

    await vi.advanceTimersByTimeAsync(100)

    expect(documentStoragePortMock.saveMarkdownFile).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
