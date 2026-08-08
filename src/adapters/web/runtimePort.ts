import type { RuntimePort, Unsubscribe } from '../../core/contracts'
import { getMobileViewportMediaQuery, isMacPlatform } from '../../shared/platform/runtime'

export const webRuntimePort: RuntimePort = {
  getInitialContext() {
    const mobileQuery = getMobileViewportMediaQuery()
    return { isTauri: false, isMac: isMacPlatform(), isMobile: mobileQuery?.matches ?? false }
  },

  readFullscreen() {
    return Promise.resolve(false)
  },

  subscribeMobile(listener): Unsubscribe {
    const mobileQuery = getMobileViewportMediaQuery()
    if (!mobileQuery) return () => {}
    const handleChange = () => listener(mobileQuery.matches)
    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleChange)
      return () => mobileQuery.removeEventListener('change', handleChange)
    }
    mobileQuery.addListener(handleChange)
    return () => mobileQuery.removeListener(handleChange)
  },

  subscribeWindowState() {
    return Promise.resolve(() => {})
  },
}
