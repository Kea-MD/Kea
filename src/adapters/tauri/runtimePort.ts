import { getCurrentWindow } from '@tauri-apps/api/window'
import type { RuntimePort, Unsubscribe } from '../../core/contracts'
import { getMobileViewportMediaQuery, isMacPlatform, isTauriRuntime } from '../../shared/platform/runtime'
import { webRuntimePort } from '../web/runtimePort'

export const tauriRuntimePort: RuntimePort = {
  getInitialContext() {
    const mobileQuery = getMobileViewportMediaQuery()
    return { isTauri: isTauriRuntime(), isMac: isMacPlatform(), isMobile: mobileQuery?.matches ?? false }
  },

  readFullscreen() {
    return getCurrentWindow().isFullscreen().catch((error: unknown) => {
      console.error('Failed to read fullscreen state:', error)
      return false
    })
  },

  subscribeMobile: webRuntimePort.subscribeMobile,

  async subscribeWindowState(listener): Promise<Unsubscribe> {
    try {
      return await getCurrentWindow().onResized(listener)
    } catch (error) {
      console.error('Failed to watch window state:', error)
      return () => {}
    }
  },
}
