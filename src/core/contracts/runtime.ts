export type Unsubscribe = () => void

export interface RuntimeContext {
  isTauri: boolean
  isMac: boolean
  isFullscreen: boolean
  isMobile: boolean
  hasTrafficLightsInset: boolean
}

export interface RuntimePort {
  getInitialContext: () => Pick<RuntimeContext, 'isTauri' | 'isMac' | 'isMobile'>
  readFullscreen: () => Promise<boolean>
  subscribeMobile: (listener: (isMobile: boolean) => void) => Unsubscribe
  subscribeWindowState: (listener: () => void) => Promise<Unsubscribe>
}
