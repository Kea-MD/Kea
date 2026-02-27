import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSidebarInteraction } from '../../src/modules/workspace/runtime/useSidebarInteraction'

const Harness = defineComponent({
  setup() {
    return useSidebarInteraction()
  },
  template: '<div />',
})

describe('useSidebarInteraction', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('disables hover briefly when toggling sidebar closed', () => {
    vi.useFakeTimers()
    const wrapper = mount(Harness)
    const vm = wrapper.vm as unknown as {
      sidebarOpen: boolean
      sidebarHovering: boolean
      toggleSidebar: () => void
      handleSidebarHover: (hovering: boolean) => void
    }

    vm.handleSidebarHover(true)
    expect(vm.sidebarHovering).toBe(true)

    vm.toggleSidebar()
    expect(vm.sidebarOpen).toBe(false)
    expect(vm.sidebarHovering).toBe(false)

    vm.handleSidebarHover(true)
    expect(vm.sidebarHovering).toBe(false)

    vi.advanceTimersByTime(300)
    vm.handleSidebarHover(true)
    expect(vm.sidebarHovering).toBe(true)
  })

  it('uses delayed hover-out and clears timeout on unmount', () => {
    vi.useFakeTimers()
    const wrapper = mount(Harness)
    const vm = wrapper.vm as unknown as {
      sidebarHovering: boolean
      handleSidebarHover: (hovering: boolean) => void
    }

    vm.handleSidebarHover(true)
    expect(vm.sidebarHovering).toBe(true)

    vm.handleSidebarHover(false)
    vm.handleSidebarHover(false)
    vi.advanceTimersByTime(199)
    expect(vm.sidebarHovering).toBe(true)

    wrapper.unmount()
    vi.advanceTimersByTime(10)
    expect(vm.sidebarHovering).toBe(true)
  })

  it('applies delayed hover-out when sidebar remains mounted', () => {
    vi.useFakeTimers()
    const wrapper = mount(Harness)
    const vm = wrapper.vm as unknown as {
      sidebarHovering: boolean
      handleSidebarHover: (hovering: boolean) => void
    }

    vm.handleSidebarHover(true)
    vm.handleSidebarHover(false)
    vi.advanceTimersByTime(200)

    expect(vm.sidebarHovering).toBe(false)
    wrapper.unmount()
  })
})
