import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

const STORAGE_KEY = 'kea-sidebar-width'
const DEFAULT_WIDTH = 260
const MIN_WIDTH = 200
const MAX_WIDTH = 500

export function useSidebarResize(): {
  sidebarWidth: number
  isResizing: boolean
  startResize: (event: ReactMouseEvent<HTMLElement>) => void
} {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    const width = saved ? Number.parseInt(saved, 10) : Number.NaN
    if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width)
  }, [])

  const startResize = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault()
    cleanupRef.current?.()
    const startX = event.clientX
    let latestWidth = sidebarWidth
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, sidebarWidth + moveEvent.clientX - startX))
      latestWidth = nextWidth
      setSidebarWidth(nextWidth)
    }
    const stopResize = () => {
      setIsResizing(false)
      window.localStorage.setItem(STORAGE_KEY, String(latestWidth))
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', stopResize)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      cleanupRef.current = null
    }

    cleanupRef.current = stopResize
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResize)
  }, [sidebarWidth])

  useEffect(() => () => cleanupRef.current?.(), [])

  return { sidebarWidth, isResizing, startResize }
}
