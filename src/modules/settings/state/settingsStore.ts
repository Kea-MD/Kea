import { defineStore } from 'pinia'
import {
  getDefaultShortcutMap,
  normaliseShortcutBinding,
  shortcutActionIds,
  shortcutHasPrimaryModifier,
  type ShortcutActionId,
  type ShortcutMap,
} from '../shortcuts/shortcutRegistry'

const SETTINGS_STORAGE_KEY = 'kea-settings'

interface SettingsStorageV2 {
  version: 2
  workspace: {
    restoreWorkspaceOnLaunch: boolean
  }
  effects: {
    edgeGlowEnabled: boolean
  }
  shortcuts: ShortcutMap
}

type ParsedSettingsStorage = {
  workspace?: {
    restoreWorkspaceOnLaunch?: boolean
  }
  effects?: {
    edgeGlowEnabled?: boolean
  }
  shortcuts?: Partial<Record<ShortcutActionId, string>>
}

interface SettingsState {
  restoreWorkspaceOnLaunch: boolean
  edgeGlowEnabled: boolean
  shortcuts: ShortcutMap
  isCapturingShortcut: boolean
}

const defaultSettings: SettingsStorageV2 = {
  version: 2,
  workspace: {
    restoreWorkspaceOnLaunch: true,
  },
  effects: {
    edgeGlowEnabled: true,
  },
  shortcuts: getDefaultShortcutMap(),
}

function normaliseStoredShortcuts(input: unknown): ShortcutMap {
  const defaults = getDefaultShortcutMap()

  if (!input || typeof input !== 'object') {
    return defaults
  }

  const shortcuts = input as Partial<Record<ShortcutActionId, unknown>>
  const result = { ...defaults }

  shortcutActionIds.forEach(actionId => {
    const rawValue = shortcuts[actionId]
    if (typeof rawValue !== 'string') {
      return
    }

    const normalised = normaliseShortcutBinding(rawValue)
    if (normalised !== null) {
      result[actionId] = normalised
    }
  })

  return result
}

function readStoredSettings(): SettingsStorageV2 {
  const rawValue = localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (!rawValue) {
    return defaultSettings
  }

  try {
    const parsed = JSON.parse(rawValue) as ParsedSettingsStorage
    const restoreWorkspaceOnLaunch = parsed.workspace?.restoreWorkspaceOnLaunch
    const edgeGlowEnabled = parsed.effects?.edgeGlowEnabled

    return {
      version: 2,
      workspace: {
        restoreWorkspaceOnLaunch:
          typeof restoreWorkspaceOnLaunch === 'boolean'
            ? restoreWorkspaceOnLaunch
            : defaultSettings.workspace.restoreWorkspaceOnLaunch,
      },
      effects: {
        edgeGlowEnabled:
          typeof edgeGlowEnabled === 'boolean'
            ? edgeGlowEnabled
            : defaultSettings.effects.edgeGlowEnabled,
      },
      shortcuts: normaliseStoredShortcuts(parsed.shortcuts),
    }
  } catch (error) {
    console.error('Failed to read settings:', error)
    return defaultSettings
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => {
    const stored = readStoredSettings()

    return {
      restoreWorkspaceOnLaunch: stored.workspace.restoreWorkspaceOnLaunch,
      edgeGlowEnabled: stored.effects.edgeGlowEnabled,
      shortcuts: stored.shortcuts,
      isCapturingShortcut: false,
    }
  },

  actions: {
    persistSettings(): void {
      const payload: SettingsStorageV2 = {
        version: 2,
        workspace: {
          restoreWorkspaceOnLaunch: this.restoreWorkspaceOnLaunch,
        },
        effects: {
          edgeGlowEnabled: this.edgeGlowEnabled,
        },
        shortcuts: this.shortcuts,
      }

      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload))
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
    },

    setRestoreWorkspaceOnLaunch(value: boolean): void {
      this.restoreWorkspaceOnLaunch = value
      this.persistSettings()
    },

    setEdgeGlowEnabled(value: boolean): void {
      this.edgeGlowEnabled = value
      this.persistSettings()
    },

    setShortcut(actionId: ShortcutActionId, binding: string): boolean {
      const normalised = normaliseShortcutBinding(binding)
      if (normalised === null) {
        return false
      }

      if (normalised !== '' && !shortcutHasPrimaryModifier(normalised)) {
        return false
      }

      if (normalised !== '') {
        shortcutActionIds.forEach(existingActionId => {
          if (existingActionId === actionId) return
          if (this.shortcuts[existingActionId] === normalised) {
            this.shortcuts[existingActionId] = ''
          }
        })
      }

      this.shortcuts[actionId] = normalised
      this.persistSettings()
      return true
    },

    resetShortcut(actionId: ShortcutActionId): void {
      const defaults = getDefaultShortcutMap()
      this.shortcuts[actionId] = defaults[actionId]
      this.persistSettings()
    },

    resetAllShortcuts(): void {
      this.shortcuts = getDefaultShortcutMap()
      this.persistSettings()
    },

    setShortcutCaptureActive(value: boolean): void {
      this.isCapturingShortcut = value
    },
  },
})
