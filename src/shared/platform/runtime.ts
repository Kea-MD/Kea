const MOBILE_VIEWPORT_QUERY = '(max-width: 900px), (pointer: coarse)'

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return '__TAURI_INTERNALS__' in (window as TauriWindow)
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return navigator.platform.toUpperCase().includes('MAC')
}

export function isWebRuntime(): boolean {
  return !isTauriRuntime()
}

export function getMobileViewportMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null
  }

  return window.matchMedia(MOBILE_VIEWPORT_QUERY)
}

export function isMobileViewport(): boolean {
  return getMobileViewportMediaQuery()?.matches ?? false
}
