import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { calculateScrollbarMetrics } from './scrollbarMetrics'

const MINIMUM_THUMB_LENGTH = 34
const SCROLL_ACTIVE_DELAY_MS = 700

interface RenderedMetrics {
  visible: boolean
  trackLength: number
  thumbLength: number
  thumbTop: number
}

interface DragState {
  pointerId: number
  grabOffset: number
}

const emptyMetrics: RenderedMetrics = {
  visible: false,
  trackLength: 0,
  thumbLength: 0,
  thumbTop: 0,
}

export function StraightOverlayScrollbar({ scrollElement }: { scrollElement: HTMLElement | null }) {
  const scrollbarRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const activeTimeoutRef = useRef<number | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const metricsRef = useRef<RenderedMetrics>(emptyMetrics)
  const updateMetricsRef = useRef<() => void>(() => {})

  const markActive = useCallback(() => {
    const scrollbar = scrollbarRef.current
    if (!scrollbar) return
    scrollbar.dataset.active = 'true'
    if (activeTimeoutRef.current !== null) window.clearTimeout(activeTimeoutRef.current)
    activeTimeoutRef.current = window.setTimeout(() => {
      activeTimeoutRef.current = null
      if (!dragRef.current) scrollbar.dataset.active = 'false'
    }, SCROLL_ACTIVE_DELAY_MS)
  }, [])

  const scheduleMetricsUpdate = useCallback((showActivity = false) => {
    if (showActivity) markActive()
    if (frameRef.current) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0
      updateMetricsRef.current()
    })
  }, [markActive])

  updateMetricsRef.current = () => {
    const scrollbar = scrollbarRef.current
    const thumb = thumbRef.current
    if (!scrollbar || !thumb || !scrollElement) return

    const trackLength = scrollbar.clientHeight
    const metrics = calculateScrollbarMetrics({
      scrollTop: scrollElement.scrollTop,
      scrollHeight: scrollElement.scrollHeight,
      clientHeight: scrollElement.clientHeight,
      pathLength: trackLength,
      minimumThumbLength: MINIMUM_THUMB_LENGTH,
    })
    const thumbLength = metrics.thumbFraction * trackLength
    const thumbTop = metrics.startFraction * trackLength
    metricsRef.current = { visible: metrics.visible, trackLength, thumbLength, thumbTop }
    thumb.style.height = `${thumbLength}px`
    thumb.style.transform = `translate3d(0, ${thumbTop}px, 0)`
    scrollbar.dataset.scrollable = metrics.visible ? 'true' : 'false'
  }

  useLayoutEffect(() => {
    updateMetricsRef.current()
  }, [scrollElement])

  useEffect(() => {
    if (!scrollElement) return
    const handleScroll = () => scheduleMetricsUpdate(true)
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => scheduleMetricsUpdate())
    resizeObserver?.observe(scrollElement)
    if (scrollbarRef.current) resizeObserver?.observe(scrollbarRef.current)

    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => scheduleMetricsUpdate())
    mutationObserver?.observe(scrollElement, { childList: true, subtree: true })
    scheduleMetricsUpdate()

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [scheduleMetricsUpdate, scrollElement])

  useEffect(() => () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    if (activeTimeoutRef.current !== null) window.clearTimeout(activeTimeoutRef.current)
  }, [])

  const setScrollFromPointer = (event: ReactPointerEvent<HTMLDivElement>, grabOffset: number): void => {
    const scrollbar = scrollbarRef.current
    const metrics = metricsRef.current
    if (!scrollbar || !scrollElement || !metrics.visible) return
    const pointerY = event.clientY - scrollbar.getBoundingClientRect().top
    const travelLength = Math.max(0, metrics.trackLength - metrics.thumbLength)
    const thumbTop = Math.min(travelLength, Math.max(0, pointerY - grabOffset))
    const progress = travelLength > 0 ? thumbTop / travelLength : 0
    scrollElement.scrollTop = progress * Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
    scheduleMetricsUpdate(true)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || !metricsRef.current.visible) return
    const scrollbar = scrollbarRef.current
    if (!scrollbar) return
    const metrics = metricsRef.current
    const pointerY = event.clientY - scrollbar.getBoundingClientRect().top
    const thumbBottom = metrics.thumbTop + metrics.thumbLength
    const grabOffset = pointerY >= metrics.thumbTop && pointerY <= thumbBottom
      ? pointerY - metrics.thumbTop
      : metrics.thumbLength / 2

    dragRef.current = { pointerId: event.pointerId, grabOffset }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    if (pointerY < metrics.thumbTop || pointerY > thumbBottom) setScrollFromPointer(event, grabOffset)
    markActive()
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setScrollFromPointer(event, drag.grabOffset)
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    markActive()
  }

  return (
    <div
      ref={scrollbarRef}
      className="straight-overlay-scrollbar"
      data-scrollable="false"
      data-active="false"
      aria-hidden="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
    >
      <div ref={thumbRef} className="straight-overlay-scrollbar-thumb" />
    </div>
  )
}
