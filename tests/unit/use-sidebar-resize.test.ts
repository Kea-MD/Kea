import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSidebarResize } from '../../src/modules/workspace/runtime/useSidebarResize'

const Harness = defineComponent({
  setup() {
    return useSidebarResize()
  },
  template: '<div />',
})

describe('useSidebarResize', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads persisted width and supports resize interactions', async () => {
    localStorage.setItem('kea-sidebar-width', '300')
    const wrapper = mount(Harness)
    const vm = wrapper.vm as unknown as {
      sidebarWidth: number
      isResizing: boolean
      startResize: (event: MouseEvent) => void
    }

    await nextTick()
    expect(vm.sidebarWidth).toBe(300)

    vm.startResize(new MouseEvent('mousedown', { clientX: 100 }))
    expect(vm.isResizing).toBe(true)
    expect(document.body.style.cursor).toBe('col-resize')

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 240 }))
    expect(vm.sidebarWidth).toBe(440)

    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(vm.isResizing).toBe(false)
    expect(localStorage.getItem('kea-sidebar-width')).toBe('440')
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')

    wrapper.unmount()
  })

  it('clamps width to configured min and max bounds', () => {
    const wrapper = mount(Harness)
    const vm = wrapper.vm as unknown as {
      sidebarWidth: number
      startResize: (event: MouseEvent) => void
    }

    vm.startResize(new MouseEvent('mousedown', { clientX: 100 }))

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: -500 }))
    expect(vm.sidebarWidth).toBe(200)

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1200 }))
    expect(vm.sidebarWidth).toBe(500)

    document.dispatchEvent(new MouseEvent('mouseup'))
    wrapper.unmount()
  })

  it('ignores invalid saved widths outside allowed bounds', async () => {
    localStorage.setItem('kea-sidebar-width', '260')
    const resetWrapper = mount(Harness)
    await nextTick()
    resetWrapper.unmount()

    localStorage.setItem('kea-sidebar-width', '999')
    const wrapper = mount(Harness)
    const vm = wrapper.vm as unknown as { sidebarWidth: number }

    await nextTick()
    expect(vm.sidebarWidth).toBe(260)

    wrapper.unmount()
  })

  it('ignores mousemove updates when not actively resizing', () => {
    const wrapper = mount(Harness)
    const vm = wrapper.vm as unknown as { sidebarWidth: number }

    const initialWidth = vm.sidebarWidth
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 999 }))

    expect(vm.sidebarWidth).toBe(initialWidth)
    wrapper.unmount()
  })
})
