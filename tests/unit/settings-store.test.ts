import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../../src/modules/settings/state/settingsStore'

describe('settingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults restore workspace on launch to true', () => {
    const settingsStore = useSettingsStore()
    expect(settingsStore.restoreWorkspaceOnLaunch).toBe(true)
    expect(settingsStore.edgeGlowEnabled).toBe(true)
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
  })

  it('persists settings when restore workspace preference changes', () => {
    const settingsStore = useSettingsStore()
    settingsStore.setRestoreWorkspaceOnLaunch(false)

    const persisted = localStorage.getItem('kea-settings')
    expect(persisted).toBeTruthy()
    expect(JSON.parse(persisted || '{}')).toEqual({
      version: 1,
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
    expect(JSON.parse(persisted || '{}')).toEqual({
      version: 1,
      workspace: {
        restoreWorkspaceOnLaunch: true,
      },
      effects: {
        edgeGlowEnabled: false,
      },
    })
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
