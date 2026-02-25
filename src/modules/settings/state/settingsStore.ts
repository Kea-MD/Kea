import { defineStore } from 'pinia'

const SETTINGS_STORAGE_KEY = 'kea-settings'

interface SettingsStorageV1 {
  version: 1
  workspace: {
    restoreWorkspaceOnLaunch: boolean
  }
}

interface SettingsState {
  restoreWorkspaceOnLaunch: boolean
}

const defaultSettings: SettingsStorageV1 = {
  version: 1,
  workspace: {
    restoreWorkspaceOnLaunch: true,
  },
}

function readStoredSettings(): SettingsStorageV1 {
  const rawValue = localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (!rawValue) {
    return defaultSettings
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SettingsStorageV1>
    const restoreWorkspaceOnLaunch = parsed.workspace?.restoreWorkspaceOnLaunch

    return {
      version: 1,
      workspace: {
        restoreWorkspaceOnLaunch:
          typeof restoreWorkspaceOnLaunch === 'boolean'
            ? restoreWorkspaceOnLaunch
            : defaultSettings.workspace.restoreWorkspaceOnLaunch,
      },
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
    }
  },

  actions: {
    persistSettings(): void {
      const payload: SettingsStorageV1 = {
        version: 1,
        workspace: {
          restoreWorkspaceOnLaunch: this.restoreWorkspaceOnLaunch,
        },
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
  },
})
