import { useCallback, useEffect, useState } from 'react'
import type { ThemeMode } from './core/contracts/settings'

export type { ThemeMode } from './core/contracts/settings'

const STORAGE_KEY = 'kea-theme-preference'

function getSystemPreference(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readPreference(): ThemeMode {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}

function applyTheme(mode: ThemeMode): boolean {
  const dark = mode === 'dark' || (mode === 'system' && getSystemPreference())
  document.documentElement.classList.toggle('dark', dark)
  return dark
}

export function useReactTheme(): {
  isDark: boolean
  themeMode: ThemeMode
  toggleTheme: () => void
  setThemeMode: (mode: ThemeMode) => void
} {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => readPreference())
  const [isDark, setIsDark] = useState<boolean>(() => applyTheme(readPreference()))

  const setThemeMode = useCallback((mode: ThemeMode) => {
    window.localStorage.setItem(STORAGE_KEY, mode)
    setThemeModeState(mode)
    setIsDark(applyTheme(mode))
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeMode(isDark ? 'light' : 'dark')
  }, [isDark, setThemeMode])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (themeMode === 'system') setIsDark(applyTheme('system'))
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeMode])

  return { isDark, themeMode, toggleTheme, setThemeMode }
}
