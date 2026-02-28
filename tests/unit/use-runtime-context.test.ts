import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const isFullscreenMock = vi.hoisted(() => vi.fn())
const onResizedMock = vi.hoisted(() => vi.fn())
const getCurrentWindowMock = vi.hoisted(() => vi.fn(() => ({
  isFullscreen: isFullscreenMock,
  onResized: onResizedMock,
})))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: getCurrentWindowMock,
}))

import { useRuntimeContext } from '../../src/shared/composables/useRuntimeContext'

const RuntimeContextHarness = defineComponent({
  setup() {
    return useRuntimeContext()
  },
  template: '<div />',
})

function setNavigatorPlatform(platform: string) {
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: platform,
  })
}

function installMatchMedia(matches: boolean) {
  let changeHandler: (() => void) | null = null

  const mediaQueryList = {
    matches,
    media: '(max-width: 900px), (pointer: coarse)',
    onchange: null,
    addEventListener: vi.fn((event: string, handler: EventListenerOrEventListenerObject) => {
      if (event === 'change') {
        changeHandler = handler as () => void
      }
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }

  vi.spyOn(window, 'matchMedia').mockImplementation(() => mediaQueryList as unknown as MediaQueryList)

  return {
    setMatches(next: boolean) {
      mediaQueryList.matches = next
      changeHandler?.()
    },
  }
}

async function flushRuntimeContext() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function getVmState(wrapper: ReturnType<typeof mount>, key: string): boolean {
  const source = (wrapper.vm as unknown as Record<string, unknown>)[key]

  if (
    typeof source === 'object'
    && source !== null
    && 'value' in source
  ) {
    return Boolean((source as { value: unknown }).value)
  }

  return Boolean(source)
}

describe('useRuntimeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setNavigatorPlatform('MacIntel')
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, '__TAURI_INTERNALS__')
    isFullscreenMock.mockResolvedValue(false)
    onResizedMock.mockResolvedValue(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, '__TAURI_INTERNALS__')
  })

  it('reports web runtime defaults when tauri internals are missing', async () => {
    installMatchMedia(false)
    const wrapper = mount(RuntimeContextHarness)

    await flushRuntimeContext()

    expect(getVmState(wrapper, 'isTauri')).toBe(false)
    expect(getVmState(wrapper, 'isMac')).toBe(true)
    expect(getVmState(wrapper, 'isFullscreen')).toBe(false)
    expect(getVmState(wrapper, 'isMobile')).toBe(false)
    expect(getVmState(wrapper, 'hasTrafficLightsInset')).toBe(false)
    expect(getCurrentWindowMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('enables traffic-light inset in tauri mac windowed mode and updates on resize/fullscreen changes', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })

    installMatchMedia(false)

    let resizeHandler: (() => void) | null = null
    const unlistenResize = vi.fn()
    onResizedMock.mockImplementation(async (handler: () => void) => {
      resizeHandler = handler
      return unlistenResize
    })

    let fullscreenState = false
    isFullscreenMock.mockImplementation(async () => fullscreenState)

    const wrapper = mount(RuntimeContextHarness)
    await flushRuntimeContext()

    expect(getVmState(wrapper, 'isTauri')).toBe(true)
    expect(getVmState(wrapper, 'hasTrafficLightsInset')).toBe(true)

    fullscreenState = true

    if (resizeHandler !== null) {
      ;(resizeHandler as () => void)()
    }
    await flushRuntimeContext()

    expect(getVmState(wrapper, 'isFullscreen')).toBe(true)
    expect(getVmState(wrapper, 'hasTrafficLightsInset')).toBe(false)

    wrapper.unmount()
    expect(unlistenResize).toHaveBeenCalledTimes(1)
  })

  it('disables traffic-light inset on mobile viewports and re-enables when viewport changes back', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })

    const media = installMatchMedia(true)
    isFullscreenMock.mockResolvedValue(false)
    onResizedMock.mockResolvedValue(() => {})

    const wrapper = mount(RuntimeContextHarness)
    await flushRuntimeContext()

    expect(getVmState(wrapper, 'isMobile')).toBe(true)
    expect(getVmState(wrapper, 'hasTrafficLightsInset')).toBe(false)

    media.setMatches(false)
    await flushRuntimeContext()

    expect(getVmState(wrapper, 'isMobile')).toBe(false)
    expect(getVmState(wrapper, 'hasTrafficLightsInset')).toBe(true)

    wrapper.unmount()
  })
})
