import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultShortcutMap } from '../../src/modules/settings/shortcuts/shortcutRegistry'
import { useSettingsStore } from '../../src/modules/settings/state/settingsStore'

describe('settingsStore', () => {
  const storage = new Map<string, string>()

  const localStorageMock: Storage = {
    get length() {
      return storage.size
    },
    clear() {
      storage.clear()
    },
    getItem(key: string) {
      return storage.has(key) ? storage.get(key) ?? null : null
    },
    key(index: number) {
      return Array.from(storage.keys())[index] ?? null
    },
    removeItem(key: string) {
      storage.delete(key)
    },
    setItem(key: string, value: string) {
      storage.set(key, value)
    },
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    storage.clear()
    vi.stubGlobal('localStorage', localStorageMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('defaults restore workspace on launch to true', () => {
    const settingsStore = useSettingsStore()
    expect(settingsStore.restoreWorkspaceOnLaunch).toBe(true)
    expect(settingsStore.edgeGlowEnabled).toBe(true)
    expect(settingsStore.shortcuts).toEqual(getDefaultShortcutMap())
  })

  it('loads restore workspace preference from localStorage', () => {
    localStorage.setItem('kea-settings', JSON.stringify({
      version: 1,
      workspace: {
        restoreWorkspaceOnLaunch: false,
      },
      effects: {
        edgeGlowEnabled: false,
      },
    }))

    const settingsStore = useSettingsStore()
    expect(settingsStore.restoreWorkspaceOnLaunch).toBe(false)
    expect(settingsStore.edgeGlowEnabled).toBe(false)
    expect(settingsStore.shortcuts).toEqual(getDefaultShortcutMap())
  })

  it('persists settings when restore workspace preference changes', () => {
    const settingsStore = useSettingsStore()
    settingsStore.setRestoreWorkspaceOnLaunch(false)

    const persisted = localStorage.getItem('kea-settings')
    expect(persisted).toBeTruthy()
    expect(JSON.parse(persisted || '{}')).toMatchObject({
      version: 2,
      workspace: {
        restoreWorkspaceOnLaunch: false,
      },
      effects: {
        edgeGlowEnabled: true,
      },
    })
  })

  it('persists settings when edge glow preference changes', () => {
    const settingsStore = useSettingsStore()
    settingsStore.setEdgeGlowEnabled(false)

    const persisted = localStorage.getItem('kea-settings')
    expect(persisted).toBeTruthy()
    expect(JSON.parse(persisted || '{}')).toMatchObject({
      version: 2,
      workspace: {
        restoreWorkspaceOnLaunch: true,
      },
      effects: {
        edgeGlowEnabled: false,
      },
    })
  })

  it('loads and normalises stored shortcut bindings', () => {
    localStorage.setItem('kea-settings', JSON.stringify({
      version: 2,
      workspace: {
        restoreWorkspaceOnLaunch: true,
      },
      effects: {
        edgeGlowEnabled: true,
      },
      shortcuts: {
        open_settings: 'cmd + ,',
        quick_open: 'ctrl+p',
      },
    }))

    const settingsStore = useSettingsStore()
    expect(settingsStore.shortcuts.open_settings).toBe('Mod+,')
    expect(settingsStore.shortcuts.quick_open).toBe('Mod+P')
  })

  it('rejects shortcuts that do not include Ctrl/Cmd or Alt', () => {
    const settingsStore = useSettingsStore()

    const wasSet = settingsStore.setShortcut('quick_open', 'Shift+P')

    expect(wasSet).toBe(false)
    expect(settingsStore.shortcuts.quick_open).toBe('Mod+P')
  })

  it('clears duplicate shortcut assignment from other action', () => {
    const settingsStore = useSettingsStore()

    const wasSet = settingsStore.setShortcut('open_settings', 'Mod+P')

    expect(wasSet).toBe(true)
    expect(settingsStore.shortcuts.open_settings).toBe('Mod+P')
    expect(settingsStore.shortcuts.quick_open).toBe('')
  })

  it('falls back to defaults on malformed storage values', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('kea-settings', '{bad json')

    const settingsStore = useSettingsStore()

    expect(settingsStore.restoreWorkspaceOnLaunch).toBe(true)
    expect(settingsStore.edgeGlowEnabled).toBe(true)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
