import { ref, onMounted } from 'vue'

type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'orca-theme-preference'

// Shared state across all instances
const isDark = ref(false)
const themeMode = ref<ThemeMode>('system')

export function useTheme() {
  const getSystemPreference = (): boolean => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  const applyTheme = (dark: boolean) => {
    isDark.value = dark
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const setThemeMode = (mode: ThemeMode) => {
    themeMode.value = mode
    localStorage.setItem(STORAGE_KEY, mode)
    
    if (mode === 'system') {
      applyTheme(getSystemPreference())
    } else {
      applyTheme(mode === 'dark')
    }
  }

  const toggleTheme = () => {
    // If in system mode, switch to explicit opposite of current
    // Otherwise toggle between light and dark
    if (themeMode.value === 'system') {
      setThemeMode(isDark.value ? 'light' : 'dark')
    } else {
      setThemeMode(themeMode.value === 'dark' ? 'light' : 'dark')
    }
  }

  const initTheme = () => {
    // Load saved preference
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      setThemeMode(saved)
    } else {
      setThemeMode('system')
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      if (themeMode.value === 'system') {
        applyTheme(e.matches)
      }
    })
  }

  onMounted(() => {
    initTheme()
  })

  return {
    isDark,
    themeMode,
    toggleTheme,
    setThemeMode,
  }
}

