export type ThemeMode = 'light' | 'dark' | 'system'

export interface SettingsSnapshot {
  restoreWorkspaceOnLaunch: boolean
  edgeGlowEnabled: boolean
  shortcuts: Record<string, string>
}

export interface SettingsPort {
  load: () => SettingsSnapshot
  save: (settings: SettingsSnapshot) => void
}
