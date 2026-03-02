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

function createRect(left: number, width: number, top = 100, height = 28): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect
}

function setRect(element: Element, rect: DOMRect) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect,
  })
}

function setOffsets(element: Element, left: number, width: number) {
  Object.defineProperty(element, 'offsetLeft', {
    configurable: true,
    get: () => left,
  })

  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    get: () => width,
  })
}

function applyMeasuredGeometry(wrapper: ReturnType<typeof mount>) {
  const tabsContainer = wrapper.get('.tabs-container').element
  const tabsList = wrapper.get('.tabs-list').element
  const tabs = wrapper.findAll('.tab')

  setRect(tabsContainer, createRect(10, 300, 90, 40))
  setRect(tabsList, createRect(10, 260, 100, 30))

  tabs.forEach((tab, index) => {
    const left = 20 + (index * 110)
    const width = 100

    setRect(tab.element, createRect(left, width))
    setOffsets(tab.element, left, width)
  })
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
    vi.useFakeTimers()
    const documentStore = useDocumentStore()
    const first = makeTab('tab-1', 'first.md')
    const second = makeTab('tab-2', 'second.md')
    second.isDirty = true
    documentStore.openDocuments = [first, second]
    documentStore.activeDocumentId = 'tab-1'

    const reorderSpy = vi.spyOn(documentStore, 'reorderTabs')
    const setActiveSpy = vi.spyOn(documentStore, 'setActiveDocument')

    const frameCallbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => 0)

    const wrapper = mount(EditorTabs)
    applyMeasuredGeometry(wrapper)

    const tabs = wrapper.findAll('.tab')

    await tabs[0].trigger('mousedown', { button: 0, clientX: 20, clientY: 20 })

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 22,
      clientY: 22,
    }))

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 380,
      clientY: 40,
    }))

    frameCallbacks[0]?.(16)

    await wrapper.vm.$nextTick()

    expect(wrapper.find('.drop-indicator').exists()).toBe(true)
    expect(wrapper.find('.tab.is-drag-ghost').exists()).toBe(true)
    expect(wrapper.find('.tab.is-dragging').exists()).toBe(true)
    expect(wrapper.find('.dirty-indicator').exists()).toBe(true)

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: -100,
      clientY: 40,
    }))

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 380,
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

    await wrapper.findAll('.tab')[0].trigger('click')
    expect(setActiveSpy).not.toHaveBeenCalled()

    vi.runAllTimers()
    await wrapper.findAll('.tab')[0].trigger('click')
    expect(setActiveSpy).toHaveBeenCalled()

    wrapper.unmount()
    expect(cancelAnimationFrameSpy).toHaveBeenCalled()
  })

  it('does not begin drag for non-primary clicks', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [makeTab('tab-1', 'first.md'), makeTab('tab-2', 'second.md')]
    documentStore.activeDocumentId = 'tab-1'

    const reorderSpy = vi.spyOn(documentStore, 'reorderTabs')
    const wrapper = mount(EditorTabs)

    await wrapper.find('.tab').trigger('mousedown', { button: 2, clientX: 10, clientY: 10 })
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

    expect(reorderSpy).not.toHaveBeenCalled()
  })

  it('resets drag state when mouseup happens before drag threshold', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [makeTab('tab-1', 'first.md'), makeTab('tab-2', 'second.md')]
    documentStore.activeDocumentId = 'tab-1'

    const reorderSpy = vi.spyOn(documentStore, 'reorderTabs')
    const wrapper = mount(EditorTabs)

    await wrapper.find('.tab').trigger('mousedown', { button: 0, clientX: 20, clientY: 20 })
    document.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: 20,
    }))

    expect(reorderSpy).not.toHaveBeenCalled()
    expect(wrapper.find('.tab.is-dragging').exists()).toBe(false)
  })

  it('does not start drag when pressing the close button', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [makeTab('tab-1', 'first.md'), makeTab('tab-2', 'second.md')]
    documentStore.activeDocumentId = 'tab-1'

    const reorderSpy = vi.spyOn(documentStore, 'reorderTabs')
    const closeSpy = vi.spyOn(documentStore, 'closeDocument').mockResolvedValue(true)

    const wrapper = mount(EditorTabs)

    await wrapper.find('.close-btn').trigger('mousedown', { button: 0, clientX: 10, clientY: 10 })
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

    await wrapper.find('.close-btn').trigger('click')

    expect(reorderSpy).not.toHaveBeenCalled()
    expect(closeSpy).toHaveBeenCalledWith('tab-1')
  })

  it('skips reorder when drag ends without a valid drop target', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [makeTab('tab-1', 'first.md'), makeTab('tab-2', 'second.md')]
    documentStore.activeDocumentId = 'tab-1'

    const reorderSpy = vi.spyOn(documentStore, 'reorderTabs')
    const wrapper = mount(EditorTabs)
    const tabs = wrapper.findAll('.tab')

    setRect(wrapper.get('.tabs-container').element, createRect(10, 0, 90, 40))
    setRect(wrapper.get('.tabs-list').element, createRect(10, 0, 100, 30))
    tabs.forEach((tab) => {
      setRect(tab.element, createRect(20, 0))
      setOffsets(tab.element, 20, 0)
    })

    const elementFromPoint = vi.fn(() => null)
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint,
    })

    await tabs[0].trigger('mousedown', { button: 0, clientX: 20, clientY: 20 })
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 80,
      clientY: 40,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      clientX: 80,
      clientY: 40,
    }))

    expect(elementFromPoint).toHaveBeenCalled()
    expect(reorderSpy).not.toHaveBeenCalled()
  })

  it('uses fallback tab targeting when geometry is unavailable', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [makeTab('tab-1', 'first.md'), makeTab('tab-2', 'second.md')]
    documentStore.activeDocumentId = 'tab-1'

    const reorderSpy = vi.spyOn(documentStore, 'reorderTabs')
    const wrapper = mount(EditorTabs)
    const tabs = wrapper.findAll('.tab')

    setRect(wrapper.get('.tabs-container').element, createRect(10, 0, 90, 40))
    setRect(wrapper.get('.tabs-list').element, createRect(10, 0, 100, 30))
    tabs.forEach((tab) => {
      setRect(tab.element, createRect(20, 0))
      setOffsets(tab.element, 20, 0)
    })

    const elementFromPoint = vi.fn()
      .mockReturnValueOnce(tabs[0].element)
      .mockReturnValueOnce(tabs[1].element)

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint,
    })

    await tabs[0].trigger('mousedown', { button: 0, clientX: 20, clientY: 20 })
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 60,
      clientY: 40,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 40,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 40,
    }))

    expect(elementFromPoint).toHaveBeenCalledTimes(2)
    expect(reorderSpy).toHaveBeenCalledWith(0, 1)
  })

  it('maps vertical wheel movement to horizontal tab scrolling', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [makeTab('tab-1', 'first.md'), makeTab('tab-2', 'second.md')]
    documentStore.activeDocumentId = 'tab-1'

    const wrapper = mount(EditorTabs)
    const tabsScroller = wrapper.get('.tabs-scroll').element as HTMLElement
    const tabsScrollWrap = wrapper.get('.tabs-scroll-wrap')

    Object.defineProperty(tabsScroller, 'scrollWidth', {
      configurable: true,
      get: () => 500,
    })
    Object.defineProperty(tabsScroller, 'clientWidth', {
      configurable: true,
      get: () => 200,
    })

    tabsScroller.scrollLeft = 0
    await wrapper.get('.tabs-scroll').trigger('wheel', { deltaY: 40, deltaX: 0 })
    await wrapper.get('.tabs-scroll').trigger('scroll')

    expect(tabsScroller.scrollLeft).toBe(40)
    expect(tabsScrollWrap.classes()).toContain('has-left-fade')
    expect(tabsScrollWrap.classes()).toContain('has-right-fade')

    tabsScroller.scrollLeft = 300
    await wrapper.get('.tabs-scroll').trigger('scroll')

    expect(tabsScrollWrap.classes()).toContain('has-left-fade')
    expect(tabsScrollWrap.classes()).not.toContain('has-right-fade')
  })

  it('does not remap wheel events that already include horizontal delta', async () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [makeTab('tab-1', 'first.md'), makeTab('tab-2', 'second.md')]
    documentStore.activeDocumentId = 'tab-1'

    const wrapper = mount(EditorTabs)
    const tabsScroller = wrapper.get('.tabs-scroll').element as HTMLElement

    Object.defineProperty(tabsScroller, 'scrollWidth', {
      configurable: true,
      get: () => 500,
    })
    Object.defineProperty(tabsScroller, 'clientWidth', {
      configurable: true,
      get: () => 200,
    })

    tabsScroller.scrollLeft = 120
    await wrapper.get('.tabs-scroll').trigger('wheel', { deltaY: 40, deltaX: 18 })

    expect(tabsScroller.scrollLeft).toBe(120)
  })

  it('returns undefined drag styles when no drag UI is active', () => {
    const documentStore = useDocumentStore()
    documentStore.openDocuments = [makeTab('tab-1', 'first.md')]
    documentStore.activeDocumentId = 'tab-1'

    const wrapper = mount(EditorTabs)
    const vm = wrapper.vm as unknown as {
      getTabStyle: (tabId: string) => Record<string, string> | undefined
      getDropIndicatorStyle: () => Record<string, string> | undefined
    }

    expect(vm.getTabStyle('tab-1')).toBeUndefined()
    expect(vm.getDropIndicatorStyle()).toBeUndefined()
  })
})
