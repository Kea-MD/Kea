import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import type { RuntimeContext as RuntimeContextValue, RuntimePort, Unsubscribe } from '../core/contracts'
import { defaultRuntimePort } from '../adapters/runtime/defaultRuntimePort'

export interface RuntimeProviderProps {
  port?: RuntimePort
  children: ReactNode
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null)

function deriveContext(
  initial: Pick<RuntimeContextValue, 'isTauri' | 'isMac' | 'isMobile'>,
  isFullscreen: boolean,
): RuntimeContextValue {
  return {
    ...initial,
    isFullscreen,
    hasTrafficLightsInset: initial.isTauri && initial.isMac && !isFullscreen,
  }
}

export function RuntimeProvider({ port = defaultRuntimePort, children }: RuntimeProviderProps): ReactElement {
  const initial = port.getInitialContext()
  const [context, setContext] = useState(() => deriveContext(initial, false))

  useEffect(() => {
    let disposed = false
    let removeWindowState: Unsubscribe | undefined
    const removeMobile = port.subscribeMobile((isMobile) => {
      if (disposed) return
      setContext((current) => deriveContext({ ...current, isMobile }, current.isFullscreen))
    })

    void port.subscribeWindowState(() => {
      if (disposed) return
      void port.readFullscreen().then((isFullscreen) => {
        if (!disposed) {
          setContext((current) => current.isFullscreen === isFullscreen
            ? current
            : deriveContext(current, isFullscreen))
        }
      })
    }).then((unsubscribe) => {
      if (disposed) unsubscribe()
      else removeWindowState = unsubscribe
    })

    void port.readFullscreen().then((isFullscreen) => {
      if (!disposed) {
        setContext((current) => current.isFullscreen === isFullscreen
          ? current
          : deriveContext(current, isFullscreen))
      }
    })

    return () => {
      disposed = true
      removeMobile()
      removeWindowState?.()
    }
  }, [port])

  return <RuntimeContext.Provider value={context}>{children}</RuntimeContext.Provider>
}

export function useRuntimeContext(): RuntimeContextValue {
  const context = useContext(RuntimeContext)
  if (!context) {
    throw new Error('useRuntimeContext must be used within a RuntimeProvider')
  }
  return context
}
