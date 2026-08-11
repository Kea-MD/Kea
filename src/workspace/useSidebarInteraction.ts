import { useCallback, useEffect, useRef, useState } from 'react'
import { useHoverReveal } from './useHoverReveal'

const STORAGE_KEY = 'kea-sidebar-open'

export function useSidebarInteraction(): {
  sidebarOpen: boolean
  sidebarHovering: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
  handleSidebarHover: (hovering: boolean) => void
} {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.localStorage.getItem(STORAGE_KEY) === 'true')
  const { hovering: sidebarHovering, handleHover, closeHover } = useHoverReveal()
  const hoverDisabled = useRef(false)

  const toggleSidebar = useCallback(() => {
    if (!sidebarOpen) {
      setSidebarOpen(true)
      return
    }
    hoverDisabled.current = true
    closeHover()
    setSidebarOpen(false)
    window.setTimeout(() => {
      hoverDisabled.current = false
    }, 300)
  }, [closeHover, sidebarOpen])

  const closeSidebar = useCallback(() => {
    closeHover()
    setSidebarOpen(false)
  }, [closeHover])

  const handleSidebarHover = useCallback((hovering: boolean) => {
    if (hoverDisabled.current) return
    handleHover(hovering)
  }, [handleHover])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(sidebarOpen))
  }, [sidebarOpen])

  return { sidebarOpen, sidebarHovering, toggleSidebar, closeSidebar, handleSidebarHover }
}
