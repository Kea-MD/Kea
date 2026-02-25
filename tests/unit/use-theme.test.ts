import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTheme } from '../../src/shared/composables/useTheme'

function createMatchMediaMock(matches: boolean) {
  let changeHandler: ((event: MediaQueryListEvent) => void) | null = null

  const mediaQueryList = {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((event: string, handler: EventListenerOrEventListenerObject) => {
      if (event === 'change') {
        changeHandler = handler as (event: MediaQueryListEvent) => void
      }
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }

  vi.spyOn(window, 'matchMedia').mockImplementation(() => mediaQueryList as unknown as MediaQueryList)

  return {
    triggerSystemChange(nextMatches: boolean) {
      changeHandler?.({ matches: nextMatches } as MediaQueryListEvent)
    },
  }
}

const ThemeHarness = defineComponent({
  setup() {
    return useTheme()
  },
  template: '<div />',
})

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.remove('theme-transitioning')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initialises from system preference and responds to system changes', async () => {
    const media = createMatchMediaMock(false)
    mount(ThemeHarness)
    await nextTick()

    expect(localStorage.getItem('kea-theme-preference')).toBe('system')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    media.triggerSystemChange(true)
    await nextTick()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('respects saved preference and toggles mode correctly', async () => {
    createMatchMediaMock(true)
    localStorage.setItem('kea-theme-preference', 'dark')

    const wrapper = mount(ThemeHarness)
    await nextTick()

    expect(document.documentElement.classList.contains('dark')).toBe(true)

    ;(wrapper.vm as unknown as { toggleTheme: () => void }).toggleTheme()
    await nextTick()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('kea-theme-preference')).toBe('light')
  })
})
