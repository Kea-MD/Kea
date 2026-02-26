import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listenMock = vi.hoisted(() => vi.fn())
const fileWatchPortMock = vi.hoisted(() => ({
  startFileWatch: vi.fn(),
  stopFileWatch: vi.fn(),
  stopAllFileWatches: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}))

vi.mock('../../src/platform/tauri/fileWatch', () => ({
  tauriFileWatchPort: fileWatchPortMock,
}))

import { useExternalFileSync } from '../../src/modules/workspace/runtime/useExternalFileSync'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'

const Harness = defineComponent({
  setup() {
    useExternalFileSync()
    return {}
  },
  template: '<div />',
})

describe('useExternalFileSync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    fileWatchPortMock.startFileWatch.mockResolvedValue(undefined)
    fileWatchPortMock.stopFileWatch.mockResolvedValue(undefined)
    fileWatchPortMock.stopAllFileWatches.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, '__TAURI_INTERNALS__')
  })

  it('does nothing outside tauri runtime', async () => {
    const documentStore = useDocumentStore()
    const checkSpy = vi.spyOn(documentStore, 'checkActiveDocumentExternalChange').mockResolvedValue(undefined)

    const wrapper = mount(Harness)
    await nextTick()

    expect(fileWatchPortMock.startFileWatch).not.toHaveBeenCalled()
    expect(listenMock).not.toHaveBeenCalled()
    expect(checkSpy).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('watches active file, reacts to events, and cleans up watchers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })

    let watchEventHandler: unknown = null
    const unlistenMock = vi.fn()
    listenMock.mockImplementation(async (_name: string, handler: unknown) => {
      watchEventHandler = handler
      return unlistenMock
    })

    const emitWatchEvent = (path: string, kind: 'modified' | 'removed') => {
      const handler = watchEventHandler as
        | ((event: { payload: { path: string; kind: 'modified' | 'removed' } }) => void)
        | null

      if (handler) {
        handler({ payload: { path, kind } })
      }
    }

    const documentStore = useDocumentStore()
    documentStore.openDocuments = [
      {
        id: 'doc-1',
        path: '/workspace/one.md',
        name: 'one.md',
        content: '# one',
        savedContent: '# one',
        isDirty: false,
      },
      {
        id: 'doc-2',
        path: '/workspace/two.md',
        name: 'two.md',
        content: '# two',
        savedContent: '# two',
        isDirty: false,
      },
    ]
    documentStore.activeDocumentId = 'doc-1'

    const checkSpy = vi.spyOn(documentStore, 'checkActiveDocumentExternalChange')

    const wrapper = mount(Harness)
    await Promise.resolve()

    expect(fileWatchPortMock.startFileWatch).toHaveBeenCalledWith('/workspace/one.md')
    expect(listenMock).toHaveBeenCalledWith('file-watch-event', expect.any(Function))
    expect(checkSpy).toHaveBeenCalledTimes(1)

    emitWatchEvent('/workspace/other.md', 'modified')
    await nextTick()
    expect(checkSpy).toHaveBeenCalledTimes(1)

    emitWatchEvent('/workspace/one.md', 'modified')
    await nextTick()
    expect(checkSpy).toHaveBeenCalledTimes(2)

    documentStore.setActiveDocument('doc-2')
    await nextTick()
    await Promise.resolve()

    expect(fileWatchPortMock.stopFileWatch).toHaveBeenCalledWith('/workspace/one.md')
    expect(fileWatchPortMock.startFileWatch).toHaveBeenLastCalledWith('/workspace/two.md')

    emitWatchEvent('/workspace/two.md', 'removed')
    await nextTick()
    expect(checkSpy).toHaveBeenCalledTimes(3)

    wrapper.unmount()

    expect(unlistenMock).toHaveBeenCalledTimes(1)
    expect(fileWatchPortMock.stopAllFileWatches).toHaveBeenCalledTimes(1)
  })

  it('logs watcher lifecycle errors when start/stop/listen/cleanup fail', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    fileWatchPortMock.startFileWatch
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('start failed'))
    fileWatchPortMock.stopFileWatch.mockRejectedValueOnce(new Error('stop failed'))
    fileWatchPortMock.stopAllFileWatches.mockRejectedValueOnce(new Error('stop-all failed'))
    listenMock.mockRejectedValueOnce(new Error('listen failed'))

    const documentStore = useDocumentStore()
    documentStore.openDocuments = [
      {
        id: 'doc-1',
        path: '/workspace/one.md',
        name: 'one.md',
        content: '# one',
        savedContent: '# one',
        isDirty: false,
      },
      {
        id: 'doc-2',
        path: '/workspace/two.md',
        name: 'two.md',
        content: '# two',
        savedContent: '# two',
        isDirty: false,
      },
    ]
    documentStore.activeDocumentId = 'doc-1'
    vi.spyOn(documentStore, 'checkActiveDocumentExternalChange').mockResolvedValue(undefined)

    const wrapper = mount(Harness)
    await nextTick()
    await Promise.resolve()

    documentStore.setActiveDocument('doc-2')
    await nextTick()
    await Promise.resolve()

    wrapper.unmount()
    await Promise.resolve()

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to start file watch:', expect.any(Error))
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to stop file watch:', expect.any(Error))
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to listen for file watch events:', expect.any(Error))
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to stop file watches:', expect.any(Error))
  })
})
