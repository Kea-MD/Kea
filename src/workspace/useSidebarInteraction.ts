import { useCallback, useEffect, useRef, useState } from 'react'

export function useSidebarInteraction(): {
  sidebarOpen: boolean
  sidebarHovering: boolean
  toggleSidebar: () => void
  handleSidebarHover: (hovering: boolean) => void
} {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarHovering, setSidebarHovering] = useState(false)
  const hoverDisabled = useRef(false)
  const hoverTimeout = useRef<number | null>(null)

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeout.current === null) return
    window.clearTimeout(hoverTimeout.current)
    hoverTimeout.current = null
  }, [])

  const toggleSidebar = useCallback(() => {
    if (!sidebarOpen) {
      setSidebarOpen(true)
      return
    }
    hoverDisabled.current = true
    setSidebarHovering(false)
    setSidebarOpen(false)
    window.setTimeout(() => {
      hoverDisabled.current = false
    }, 300)
  }, [sidebarOpen])

  const handleSidebarHover = useCallback((hovering: boolean) => {
    if (hoverDisabled.current) return
    clearHoverTimeout()
    if (hovering) {
      setSidebarHovering(true)
      return
    }
    hoverTimeout.current = window.setTimeout(() => {
      hoverTimeout.current = null
      setSidebarHovering(false)
    }, 200)
  }, [clearHoverTimeout])

  useEffect(() => () => clearHoverTimeout(), [clearHoverTimeout])

  return { sidebarOpen, sidebarHovering, toggleSidebar, handleSidebarHover }
}
