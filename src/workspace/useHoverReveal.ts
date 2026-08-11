import { useCallback, useEffect, useRef, useState } from 'react'

const HOVER_CLOSE_DELAY_MS = 200

export function useHoverReveal(): {
  hovering: boolean
  handleHover: (hovering: boolean) => void
  closeHover: () => void
} {
  const [hovering, setHovering] = useState(false)
  const hoverTimeout = useRef<number | null>(null)

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeout.current === null) return
    window.clearTimeout(hoverTimeout.current)
    hoverTimeout.current = null
  }, [])

  const handleHover = useCallback((nextHovering: boolean) => {
    clearHoverTimeout()
    if (nextHovering) {
      setHovering(true)
      return
    }
    hoverTimeout.current = window.setTimeout(() => {
      hoverTimeout.current = null
      setHovering(false)
    }, HOVER_CLOSE_DELAY_MS)
  }, [clearHoverTimeout])

  const closeHover = useCallback(() => {
    clearHoverTimeout()
    setHovering(false)
  }, [clearHoverTimeout])

  useEffect(() => () => clearHoverTimeout(), [clearHoverTimeout])

  return { hovering, handleHover, closeHover }
}
