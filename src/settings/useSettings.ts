import { useCallback, useState } from 'react'
import {
  getDefaultShortcutMap,
  normaliseShortcutBinding,
  shortcutActionIds,
  shortcutHasPrimaryModifier,
  type ShortcutActionId,
  type ShortcutMap,
} from '../modules/settings/shortcuts/shortcutRegistry'

const SETTINGS_STORAGE_KEY = 'kea-settings'

export interface ReactSettings {
  restoreWorkspaceOnLaunch: boolean
  revealSidebarOnEdgeHover: boolean
  revealTopChromeOnEdgeHover: boolean
  edgeGlowEnabled: boolean
  shortcuts: ShortcutMap
}

interface StoredSettings {
  workspace?: { restoreWorkspaceOnLaunch?: unknown; revealSidebarOnEdgeHover?: unknown; revealTopChromeOnEdgeHover?: unknown }
  effects?: { edgeGlowEnabled?: unknown }
  shortcuts?: Record<string, unknown>
}

const defaultSettings: ReactSettings = {
  restoreWorkspaceOnLaunch: true,
  revealSidebarOnEdgeHover: false,
  revealTopChromeOnEdgeHover: false,
  edgeGlowEnabled: true,
  shortcuts: getDefaultShortcutMap(),
}

function normaliseStoredShortcuts(input: unknown): ShortcutMap {
  if (!input || typeof input !== 'object') return getDefaultShortcutMap()

  const stored = input as Record<string, unknown>
  const shortcuts = getDefaultShortcutMap()
  shortcutActionIds.forEach(actionId => {
    const value = stored[actionId]
    if (typeof value !== 'string') return
    const normalised = normaliseShortcutBinding(value)
    if (normalised !== null) shortcuts[actionId] = normalised
  })
  return shortcuts
}

function readSettings(): ReactSettings {
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (!raw) return defaultSettings

  try {
    const stored = JSON.parse(raw) as StoredSettings
    return {
      restoreWorkspaceOnLaunch: typeof stored.workspace?.restoreWorkspaceOnLaunch === 'boolean'
        ? stored.workspace.restoreWorkspaceOnLaunch
        : defaultSettings.restoreWorkspaceOnLaunch,
      revealSidebarOnEdgeHover: typeof stored.workspace?.revealSidebarOnEdgeHover === 'boolean'
        ? stored.workspace.revealSidebarOnEdgeHover
        : defaultSettings.revealSidebarOnEdgeHover,
      revealTopChromeOnEdgeHover: typeof stored.workspace?.revealTopChromeOnEdgeHover === 'boolean'
        ? stored.workspace.revealTopChromeOnEdgeHover
        : defaultSettings.revealTopChromeOnEdgeHover,
      edgeGlowEnabled: typeof stored.effects?.edgeGlowEnabled === 'boolean'
        ? stored.effects.edgeGlowEnabled
        : defaultSettings.edgeGlowEnabled,
      shortcuts: normaliseStoredShortcuts(stored.shortcuts),
    }
  } catch (error) {
    console.error('Failed to read settings:', error)
    return defaultSettings
  }
}

function persistSettings(settings: ReactSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      version: 2,
      workspace: {
        restoreWorkspaceOnLaunch: settings.restoreWorkspaceOnLaunch,
        revealSidebarOnEdgeHover: settings.revealSidebarOnEdgeHover,
        revealTopChromeOnEdgeHover: settings.revealTopChromeOnEdgeHover,
      },
      effects: { edgeGlowEnabled: settings.edgeGlowEnabled },
      shortcuts: settings.shortcuts,
    }))
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

export function useReactSettings(): {
  settings: ReactSettings
  setRestoreWorkspaceOnLaunch: (value: boolean) => void
  setRevealSidebarOnEdgeHover: (value: boolean) => void
  setRevealTopChromeOnEdgeHover: (value: boolean) => void
  setEdgeGlowEnabled: (value: boolean) => void
  setShortcut: (actionId: ShortcutActionId, binding: string) => boolean
  resetShortcut: (actionId: ShortcutActionId) => void
  resetAllShortcuts: () => void
} {
  const [settings, setSettings] = useState<ReactSettings>(() => readSettings())

  const updateSettings = useCallback((update: (current: ReactSettings) => ReactSettings): void => {
    setSettings(current => {
      const next = update(current)
      persistSettings(next)
      return next
    })
  }, [])

  const setRestoreWorkspaceOnLaunch = useCallback((value: boolean) => {
    updateSettings(current => ({ ...current, restoreWorkspaceOnLaunch: value }))
  }, [updateSettings])

  const setRevealSidebarOnEdgeHover = useCallback((value: boolean) => {
    updateSettings(current => ({ ...current, revealSidebarOnEdgeHover: value }))
  }, [updateSettings])

  const setRevealTopChromeOnEdgeHover = useCallback((value: boolean) => {
    updateSettings(current => ({ ...current, revealTopChromeOnEdgeHover: value }))
  }, [updateSettings])

  const setEdgeGlowEnabled = useCallback((value: boolean) => {
    updateSettings(current => ({ ...current, edgeGlowEnabled: value }))
  }, [updateSettings])

  const setShortcut = useCallback((actionId: ShortcutActionId, binding: string): boolean => {
    const normalised = normaliseShortcutBinding(binding)
    if (normalised === null || (normalised !== '' && !shortcutHasPrimaryModifier(normalised))) return false

    updateSettings(current => {
      const shortcuts = { ...current.shortcuts }
      if (normalised) {
        shortcutActionIds.forEach(existingActionId => {
          if (existingActionId !== actionId && shortcuts[existingActionId] === normalised) shortcuts[existingActionId] = ''
        })
      }
      shortcuts[actionId] = normalised
      return { ...current, shortcuts }
    })
    return true
  }, [updateSettings])

  const resetShortcut = useCallback((actionId: ShortcutActionId) => {
    const defaults = getDefaultShortcutMap()
    updateSettings(current => ({ ...current, shortcuts: { ...current.shortcuts, [actionId]: defaults[actionId] } }))
  }, [updateSettings])

  const resetAllShortcuts = useCallback(() => {
    updateSettings(current => ({ ...current, shortcuts: getDefaultShortcutMap() }))
  }, [updateSettings])

  return {
    settings,
    setRestoreWorkspaceOnLaunch,
    setRevealSidebarOnEdgeHover,
    setRevealTopChromeOnEdgeHover,
    setEdgeGlowEnabled,
    setShortcut,
    resetShortcut,
    resetAllShortcuts,
  }
}
