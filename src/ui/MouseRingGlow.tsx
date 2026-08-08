import { useEffect, useRef, type ReactElement } from 'react'

type TrailPoint = { x: number; y: number; t: number; s: number }

const FRAME_MS = 16
const MIN_DELTA_MS = 1
const MAX_DELTA_MS = 80
const STALE_EVENT_MS = 120
const JITTER_PX = 0.35
const MAX_STEP_DISTANCE_PX = 120
const SPEED_EMA_TIME_MS = 90
const MOTION_RISE_TIME_MS = 260
const MOTION_FALL_TIME_MS = 380
const MIN_POINT_STRENGTH = 0.05
const MIN_VISIBLE_ALPHA = 0.001
const MAX_POINTS = 600
const STARTUP_GEOMETRY_SYNC_FRAMES = 10

export interface MouseRingGlowProps {
  hostElement: HTMLElement | null
  glowColorRgb?: string
  glowSize?: number
  glowStrength?: number
  movementSensitivity?: number
  fadeMs?: number
  maxTrailPoints?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseRgbChannels(value: string): string {
  const trimmed = value.trim()
  return trimmed.startsWith('rgb(') && trimmed.endsWith(')') ? trimmed.slice(4, -1).trim() : trimmed
}

function createRoundedRectPath(x: number, y: number, width: number, height: number, radius: number): Path2D | null {
  if (typeof Path2D === 'undefined') return null
  const safeRadius = clamp(radius, 0, Math.min(width / 2, height / 2))
  const path = new Path2D()
  path.moveTo(x + safeRadius, y)
  path.arcTo(x + width, y, x + width, y + height, safeRadius)
  path.arcTo(x + width, y + height, x, y + height, safeRadius)
  path.arcTo(x, y + height, x, y, safeRadius)
  path.arcTo(x, y, x + width, y, safeRadius)
  path.closePath()
  return path
}

export function MouseRingGlow({
  hostElement,
  glowColorRgb = 'var(--react-brand-rgb)',
  glowSize = 500,
  glowStrength = 0.1,
  movementSensitivity = 0.5,
  fadeMs = 1000,
  maxTrailPoints = 10,
}: MouseRingGlowProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = hostElement
    if (!canvas || !host) return

    let context: CanvasRenderingContext2D | null = null
    try {
      context = canvas.getContext('2d')
    } catch {
      return
    }
    if (!context) return

    let raf = 0
    let geometryRaf = 0
    let geometrySettleRaf = 0
    let width = 1
    let height = 1
    let hostLeft = 0
    let hostTop = 0
    let glowRgb = '95, 255, 140'
    let edgeClipPath: Path2D | null = null
    let points: TrailPoint[] = []
    let lastX = 0
    let lastY = 0
    let lastT = 0
    let speedEma = 0
    let motionLevel = 0
    let resizeObserver: ResizeObserver | null = null

    const syncGlowColor = () => {
      const parsed = parseRgbChannels(glowColorRgb)
      if (parsed.startsWith('var(') && parsed.endsWith(')')) {
        const variable = parsed.slice(4, -1).trim()
        glowRgb = parseRgbChannels(getComputedStyle(host).getPropertyValue(variable) || '95, 255, 140')
      } else {
        glowRgb = parsed || '95, 255, 140'
      }
    }

    const syncGeometry = () => {
      const hostRect = host.getBoundingClientRect()
      const cutout = host.querySelector<HTMLElement>('.react-page-container')
      const dpr = window.devicePixelRatio || 1
      hostLeft = hostRect.left
      hostTop = hostRect.top
      width = Math.max(1, Math.round(hostRect.width))
      height = Math.max(1, Math.round(hostRect.height))
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context?.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (!cutout) {
        edgeClipPath = null
        return
      }
      const rect = cutout.getBoundingClientRect()
      const radius = Number.parseFloat(getComputedStyle(cutout).borderTopLeftRadius) || 0
      const cutoutPath = createRoundedRectPath(rect.left - hostRect.left, rect.top - hostRect.top, rect.width, rect.height, radius)
      if (!cutoutPath || typeof Path2D === 'undefined') {
        edgeClipPath = null
        return
      }
      const clipPath = new Path2D()
      clipPath.rect(0, 0, width, height)
      clipPath.addPath(cutoutPath)
      edgeClipPath = clipPath
    }

    const scheduleGeometrySync = () => {
      if (geometryRaf) return
      geometryRaf = window.requestAnimationFrame(() => {
        geometryRaf = 0
        syncGeometry()
      })
    }

    const runStartupGeometrySync = () => {
      let remaining = STARTUP_GEOMETRY_SYNC_FRAMES
      const tick = () => {
        syncGeometry()
        remaining -= 1
        if (remaining > 0) geometrySettleRaf = window.requestAnimationFrame(tick)
        else geometrySettleRaf = 0
      }
      geometrySettleRaf = window.requestAnimationFrame(tick)
    }

    const draw = () => {
      raf = 0
      const now = performance.now()
      const fade = Math.max(MIN_DELTA_MS, fadeMs)
      const strength = clamp(glowStrength, 0, 1)
      const size = Math.max(1, glowSize)
      while (points.length && now - points[0].t >= fade) points.shift()

      context?.clearRect(0, 0, width, height)
      context?.save()
      if (edgeClipPath) context?.clip(edgeClipPath, 'evenodd')
      for (const point of points) {
        const life = 1 - (now - point.t) / fade
        const alpha = strength * point.s * life
        if (alpha <= MIN_VISIBLE_ALPHA || !context) continue
        const radius = size * (0.5 + life * 0.5)
        const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius)
        gradient.addColorStop(0, `rgba(${glowRgb}, ${clamp(alpha, 0, 1)})`)
        gradient.addColorStop(1, `rgba(${glowRgb}, 0)`)
        context.fillStyle = gradient
        context.beginPath()
        context.arc(point.x, point.y, radius, 0, Math.PI * 2)
        context.fill()
      }
      context?.restore()
      if (points.length) raf = window.requestAnimationFrame(draw)
    }

    const onMove = (event: PointerEvent) => {
      if (!edgeClipPath) scheduleGeometrySync()
      const now = performance.now()
      const x = clamp(event.clientX - hostLeft, 0, width)
      const y = clamp(event.clientY - hostTop, 0, height)
      const dt = now - lastT
      const dtMs = clamp(dt || FRAME_MS, MIN_DELTA_MS, MAX_DELTA_MS)
      const distance = lastT ? Math.hypot(x - lastX, y - lastY) : 0
      const rawSpeed = distance < JITTER_PX ? 0 : Math.min(MAX_STEP_DISTANCE_PX, distance) / dtMs
      speedEma += (rawSpeed - speedEma) * (1 - Math.exp(-dtMs / SPEED_EMA_TIME_MS))
      const targetMotion = lastT && dt < STALE_EVENT_MS ? clamp(speedEma * Math.max(0, movementSensitivity), 0, 1) : 0
      const riseAlpha = 1 - Math.exp(-dtMs / MOTION_RISE_TIME_MS)
      const fallAlpha = 1 - Math.exp(-dtMs / MOTION_FALL_TIME_MS)
      motionLevel += (targetMotion - motionLevel) * (targetMotion > motionLevel ? riseAlpha : fallAlpha)
      points.push({ x, y, t: now, s: Math.max(MIN_POINT_STRENGTH, motionLevel * motionLevel) })
      lastX = x
      lastY = y
      lastT = now
      const fadeBudget = Math.ceil(Math.max(MIN_DELTA_MS, fadeMs) / FRAME_MS)
      const pointLimit = Math.min(MAX_POINTS, Math.max(maxTrailPoints, fadeBudget))
      if (points.length > pointLimit) points.splice(0, points.length - pointLimit)
      if (!raf) raf = window.requestAnimationFrame(draw)
    }

    const reset = () => {
      points = []
      lastT = 0
      speedEma = 0
      motionLevel = 0
      edgeClipPath = null
      context?.clearRect(0, 0, width, height)
      if (raf) window.cancelAnimationFrame(raf)
      if (geometryRaf) window.cancelAnimationFrame(geometryRaf)
      if (geometrySettleRaf) window.cancelAnimationFrame(geometrySettleRaf)
      raf = 0
      geometryRaf = 0
      geometrySettleRaf = 0
    }

    syncGlowColor()
    syncGeometry()
    runStartupGeometrySync()
    host.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', scheduleGeometrySync)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleGeometrySync)
      resizeObserver.observe(host)
      const cutout = host.querySelector<HTMLElement>('.react-page-container')
      if (cutout) resizeObserver.observe(cutout)
    }

    return () => {
      host.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', scheduleGeometrySync)
      resizeObserver?.disconnect()
      reset()
    }
  }, [hostElement, glowColorRgb, glowSize, glowStrength, movementSensitivity, fadeMs, maxTrailPoints])

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />
}
