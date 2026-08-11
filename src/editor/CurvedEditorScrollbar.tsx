import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  buildPerimeterPath,
  type PerimeterPathGeometry,
} from './curvedScrollbarGeometry'
import { calculateScrollbarMetrics, type ScrollbarMetrics } from '../ui/scrollbarMetrics'

const MINIMUM_THUMB_LENGTH = 34
const SCROLL_ACTIVE_DELAY_MS = 700

type PathMode = 'curved' | 'straight'

interface PathState extends ScrollbarMetrics {
  pathLength: number
}

interface DragState {
  pointerId: number
  mode: PathMode
  grabOffset: number
}

const emptyGeometry: PerimeterPathGeometry = { d: '', length: 0 }
const emptyPathState: PathState = {
  visible: false,
  progress: 0,
  thumbFraction: 1,
  startFraction: 0,
  pathLength: 0,
}

function closestPathDistance(path: SVGPathElement, x: number, y: number): number {
  const totalLength = path.getTotalLength()
  const steps = Math.min(180, Math.max(32, Math.ceil(totalLength / 10)))
  let bestDistance = 0
  let bestSquaredDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index <= steps; index++) {
    const distance = totalLength * index / steps
    const point = path.getPointAtLength(distance)
    const squaredDistance = (point.x - x) ** 2 + (point.y - y) ** 2
    if (squaredDistance < bestSquaredDistance) {
      bestSquaredDistance = squaredDistance
      bestDistance = distance
    }
  }

  let span = totalLength / steps
  for (let pass = 0; pass < 7; pass++) {
    const before = Math.max(0, bestDistance - span)
    const after = Math.min(totalLength, bestDistance + span)
    const beforePoint = path.getPointAtLength(before)
    const afterPoint = path.getPointAtLength(after)
    const beforeDistance = (beforePoint.x - x) ** 2 + (beforePoint.y - y) ** 2
    const afterDistance = (afterPoint.x - x) ** 2 + (afterPoint.y - y) ** 2
    if (beforeDistance < bestSquaredDistance) {
      bestSquaredDistance = beforeDistance
      bestDistance = before
    }
    if (afterDistance < bestSquaredDistance) {
      bestSquaredDistance = afterDistance
      bestDistance = after
    }
    span /= 2
  }

  return bestDistance
}

function localPointer(svg: SVGSVGElement, event: ReactPointerEvent<SVGPathElement>): { x: number; y: number } {
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const matrix = svg.getScreenCTM()
  if (!matrix) return { x: event.clientX, y: event.clientY }
  const local = point.matrixTransform(matrix.inverse())
  return { x: local.x, y: local.y }
}

export function CurvedEditorScrollbar({ scrollElement, curveTop }: { scrollElement: HTMLElement | null; curveTop: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const curvedPathRef = useRef<SVGPathElement>(null)
  const straightPathRef = useRef<SVGPathElement>(null)
  const curvedThumbRef = useRef<SVGPathElement>(null)
  const straightThumbRef = useRef<SVGPathElement>(null)
  const frameRef = useRef(0)
  const activeTimeoutRef = useRef<number | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const metricsRef = useRef<Record<PathMode, PathState>>({ curved: emptyPathState, straight: emptyPathState })
  const updateMetricsRef = useRef<() => void>(() => {})
  const [geometry, setGeometry] = useState<{ width: number; height: number; curved: PerimeterPathGeometry; straight: PerimeterPathGeometry }>({
    width: 0,
    height: 0,
    curved: emptyGeometry,
    straight: emptyGeometry,
  })

  const markActive = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.dataset.active = 'true'
    if (activeTimeoutRef.current !== null) window.clearTimeout(activeTimeoutRef.current)
    activeTimeoutRef.current = window.setTimeout(() => {
      activeTimeoutRef.current = null
      if (!dragRef.current) svg.dataset.active = 'false'
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
    const svg = svgRef.current
    if (!svg || !scrollElement) return

    const updatePath = (mode: PathMode, pathGeometry: PerimeterPathGeometry, thumb: SVGPathElement | null) => {
      const metrics = calculateScrollbarMetrics({
        scrollTop: scrollElement.scrollTop,
        scrollHeight: scrollElement.scrollHeight,
        clientHeight: scrollElement.clientHeight,
        pathLength: pathGeometry.length,
        minimumThumbLength: MINIMUM_THUMB_LENGTH,
      })
      metricsRef.current[mode] = { ...metrics, pathLength: pathGeometry.length }
      if (!thumb) return
      thumb.style.strokeDasharray = `${metrics.thumbFraction} 1`
      thumb.style.strokeDashoffset = `${-metrics.startFraction}`
    }

    updatePath('curved', geometry.curved, curvedThumbRef.current)
    updatePath('straight', geometry.straight, straightThumbRef.current)
    svg.dataset.scrollable = metricsRef.current.curved.visible || metricsRef.current.straight.visible ? 'true' : 'false'
  }

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const updateGeometry = () => {
      const width = svg.clientWidth
      const height = svg.clientHeight
      const styles = getComputedStyle(svg)
      const panelRadius = Number.parseFloat(styles.getPropertyValue('--react-panel-radius')) || 30
      const panelBorderWidth = Number.parseFloat(getComputedStyle(svg.closest('main') ?? svg).borderTopWidth) || 0
      const railRadius = Math.max(0, panelRadius - panelBorderWidth)
      const railInset = (Number.parseFloat(styles.getPropertyValue('--react-scrollbar-thumb-size')) || 3) / 2
      setGeometry(current => {
        if (current.width === width && current.height === height) return current
        return {
          width,
          height,
          curved: buildPerimeterPath({ width, height, radius: railRadius, inset: railInset, curveTop: true }),
          straight: buildPerimeterPath({ width, height, radius: railRadius, inset: railInset, curveTop: false }),
        }
      })
    }

    updateGeometry()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateGeometry)
    observer?.observe(svg)
    return () => observer?.disconnect()
  }, [])

  useLayoutEffect(() => {
    updateMetricsRef.current()
  }, [curveTop, geometry, scrollElement])

  useEffect(() => {
    if (!scrollElement) return
    const handleScroll = () => scheduleMetricsUpdate(true)
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => scheduleMetricsUpdate())
    observer?.observe(scrollElement)
    const content = scrollElement.querySelector<HTMLElement>('.cm-content')
    if (content) observer?.observe(content)
    scheduleMetricsUpdate()

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      observer?.disconnect()
    }
  }, [scheduleMetricsUpdate, scrollElement])

  useEffect(() => () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    if (activeTimeoutRef.current !== null) window.clearTimeout(activeTimeoutRef.current)
  }, [])

  const setScrollFromPointer = (mode: PathMode, event: ReactPointerEvent<SVGPathElement>, grabOffset: number): void => {
    const svg = svgRef.current
    const path = mode === 'curved' ? curvedPathRef.current : straightPathRef.current
    const state = metricsRef.current[mode]
    if (!svg || !path || !scrollElement || !state.visible) return
    const pointer = localPointer(svg, event)
    const pointerDistance = closestPathDistance(path, pointer.x, pointer.y)
    const thumbLength = state.pathLength * state.thumbFraction
    const travelLength = Math.max(0, state.pathLength - thumbLength)
    const thumbStart = Math.min(travelLength, Math.max(0, pointerDistance - grabOffset))
    const progress = travelLength > 0 ? thumbStart / travelLength : 0
    scrollElement.scrollTop = progress * Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
    scheduleMetricsUpdate(true)
  }

  const handlePointerDown = (mode: PathMode, event: ReactPointerEvent<SVGPathElement>): void => {
    if (event.button !== 0) return
    const svg = svgRef.current
    const path = mode === 'curved' ? curvedPathRef.current : straightPathRef.current
    const state = metricsRef.current[mode]
    if (!svg || !path || !state.visible) return

    const pointer = localPointer(svg, event)
    const pointerDistance = closestPathDistance(path, pointer.x, pointer.y)
    const thumbLength = state.pathLength * state.thumbFraction
    const currentStart = state.pathLength * state.startFraction
    const currentEnd = currentStart + thumbLength
    const grabOffset = pointerDistance >= currentStart && pointerDistance <= currentEnd
      ? pointerDistance - currentStart
      : thumbLength / 2

    dragRef.current = { pointerId: event.pointerId, mode, grabOffset }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    if (pointerDistance < currentStart || pointerDistance > currentEnd) setScrollFromPointer(mode, event, grabOffset)
    markActive()
  }

  const handlePointerMove = (mode: PathMode, event: ReactPointerEvent<SVGPathElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || drag.mode !== mode) return
    setScrollFromPointer(mode, event, drag.grabOffset)
  }

  const handlePointerEnd = (event: ReactPointerEvent<SVGPathElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    markActive()
  }

  const pathGroup = (mode: PathMode, pathGeometry: PerimeterPathGeometry, active: boolean) => (
    <g className={`group curved-editor-scrollbar-path${active ? ' is-active opacity-100' : ' opacity-0'}`}>
      <path
        ref={mode === 'curved' ? curvedThumbRef : straightThumbRef}
        className="curved-editor-scrollbar-thumb fill-none stroke-[var(--react-scrollbar-thumb)] [stroke-linecap:round] [stroke-width:var(--react-scrollbar-thumb-size)] [vector-effect:non-scaling-stroke] transition-[stroke] duration-120 group-hover:stroke-[var(--react-scrollbar-thumb-hover)]"
        d={pathGeometry.d}
        pathLength="1"
      />
      <path
        ref={mode === 'curved' ? curvedPathRef : straightPathRef}
        className="curved-editor-scrollbar-hit-area pointer-events-none touch-none cursor-default fill-none stroke-transparent [stroke-width:12px] [vector-effect:non-scaling-stroke]"
        d={pathGeometry.d}
        onPointerDown={event => handlePointerDown(mode, event)}
        onPointerMove={event => handlePointerMove(mode, event)}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
      />
    </g>
  )

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 z-12 h-full w-full overflow-visible opacity-0 [shape-rendering:geometricPrecision] transition-opacity duration-[160ms] motion-reduce:transition-none data-[scrollable=true]:opacity-[0.58] [&[data-scrollable=true][data-active=true]]:opacity-100 data-[scrollable=true]:hover:opacity-100 data-[scrollable=true]:[&_.is-active_.curved-editor-scrollbar-hit-area]:[pointer-events:stroke]"
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      preserveAspectRatio="none"
      data-scrollable="false"
      data-active="false"
      aria-hidden="true"
    >
      {pathGroup('straight', geometry.straight, !curveTop)}
      {pathGroup('curved', geometry.curved, curveTop)}
    </svg>
  )
}
