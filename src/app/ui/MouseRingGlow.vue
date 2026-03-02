<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

type TrailPoint = { x: number; y: number; t: number; s: number }

// Motion/quality tuning constants.
// These are intentionally centralised so behaviour changes are obvious and safe.
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

const props = withDefaults(
  defineProps<{
    hostElement?: HTMLElement | null
    glowColorRgb?: string
    glowSize?: number
    glowStrength?: number
    movementSensitivity?: number
    fadeMs?: number
    maxTrailPoints?: number
  }>(),
  {
    hostElement: null,
    glowColorRgb: 'var(--tt-brand-color-rgb)',
    glowSize: 500,
    glowStrength: 0.1,
    movementSensitivity: 0.5,
    fadeMs: 1000,
    maxTrailPoints: 10,
  },
)

const canvas = ref<HTMLCanvasElement | null>(null)

// Runtime drawing state kept outside Vue reactivity for speed.
// None of this state participates in template rendering.
let host: HTMLElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let geometryRaf = 0
let geometrySettleRaf = 0
let width = 1
let height = 1
let hostLeft = 0
let hostTop = 0
let glowRgb = '95, 255, 140'
let cutoutPath: Path2D | null = null
let edgeClipPath: Path2D | null = null
let points: TrailPoint[] = []
let lastX = 0
let lastY = 0
let lastT = 0
let speedEma = 0
let motionLevel = 0
let resizeObserver: ResizeObserver | null = null
let observedCutoutElement: HTMLElement | null = null

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const parseRgbChannels = (value: string) => {
  const trimmed = value.trim()
  return trimmed.startsWith('rgb(') && trimmed.endsWith(')') ? trimmed.slice(4, -1).trim() : trimmed
}

// Accepts plain RGB channels ("95, 255, 140"), rgb(...), or var(--token).
// Canvas gradients need resolved channel values, not raw CSS var expressions.
const syncGlowColor = () => {
  const raw = props.glowColorRgb || glowRgb
  const parsed = parseRgbChannels(raw)
  if (parsed.startsWith('var(') && parsed.endsWith(')')) {
    const variable = parsed.slice(4, -1).trim()
    glowRgb = parseRgbChannels(getComputedStyle(host || document.documentElement).getPropertyValue(variable) || '95, 255, 140')
    return
  }
  glowRgb = parsed || '95, 255, 140'
}

const createRoundedRectPath = (x: number, y: number, w: number, h: number, r: number) => {
  const radius = clamp(r, 0, Math.min(w / 2, h / 2))
  const path = new Path2D()
  path.moveTo(x + radius, y)
  path.arcTo(x + w, y, x + w, y + h, radius)
  path.arcTo(x + w, y + h, x, y + h, radius)
  path.arcTo(x, y + h, x, y, radius)
  path.arcTo(x, y, x + w, y, radius)
  path.closePath()
  return path
}

const getCutoutElement = () => host?.querySelector<HTMLElement>('.pageContainer') ?? null

const syncObservedCutoutElement = (nextCutoutElement: HTMLElement | null) => {
  if (!resizeObserver || nextCutoutElement === observedCutoutElement) return
  if (observedCutoutElement) resizeObserver.unobserve(observedCutoutElement)
  observedCutoutElement = nextCutoutElement
  if (observedCutoutElement) resizeObserver.observe(observedCutoutElement)
}

// Builds the inner cutout mask so glow is only visible around edges.
// The cutout matches `.pageContainer` geometry to keep the center clear.
const syncCutoutPath = (hostRect: DOMRect, hole: HTMLElement | null) => {
  if (!hole) {
    cutoutPath = null
    edgeClipPath = null
    return
  }
  const rect = hole.getBoundingClientRect()
  const radius = parseFloat(getComputedStyle(hole).borderTopLeftRadius) || 0
  cutoutPath = createRoundedRectPath(
    rect.left - hostRect.left,
    rect.top - hostRect.top,
    rect.width,
    rect.height,
    radius,
  )

  const clipPath = new Path2D()
  clipPath.rect(0, 0, width, height)
  clipPath.addPath(cutoutPath)
  edgeClipPath = clipPath
}

// Sync canvas size and cached host geometry (used by pointer math).
// We cache hostLeft/hostTop here to avoid repeated layout reads in pointermove.
const syncGeometry = () => {
  if (!canvas.value || !host) return
  const hostRect = host.getBoundingClientRect()
  const cutoutElement = getCutoutElement()
  const dpr = window.devicePixelRatio || 1
  hostLeft = hostRect.left
  hostTop = hostRect.top
  width = Math.max(1, Math.round(hostRect.width))
  height = Math.max(1, Math.round(hostRect.height))
  canvas.value.width = width * dpr
  canvas.value.height = height * dpr
  canvas.value.style.width = `${width}px`
  canvas.value.style.height = `${height}px`
  ctx = canvas.value.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  syncCutoutPath(hostRect, cutoutElement)
  syncObservedCutoutElement(cutoutElement)
}

const scheduleGeometrySync = () => {
  if (geometryRaf) return
  geometryRaf = requestAnimationFrame(() => {
    geometryRaf = 0
    syncGeometry()
  })
}

const runStartupGeometrySync = (frames = STARTUP_GEOMETRY_SYNC_FRAMES) => {
  if (geometrySettleRaf) {
    cancelAnimationFrame(geometrySettleRaf)
    geometrySettleRaf = 0
  }

  let remaining = Math.max(1, frames)
  const tick = () => {
    syncGeometry()
    remaining -= 1
    if (remaining > 0) {
      geometrySettleRaf = requestAnimationFrame(tick)
      return
    }
    geometrySettleRaf = 0
  }

  geometrySettleRaf = requestAnimationFrame(tick)
}

// Draw one frame: render only in the edge band clip.
// This avoids drawing glow under the center mask and reduces overdraw.
const draw = () => {
  raf = 0
  if (!ctx) return
  const now = performance.now()
  const fade = Math.max(MIN_DELTA_MS, props.fadeMs)
  const strength = clamp(props.glowStrength, 0, 1)
  const size = Math.max(1, props.glowSize)

  while (points.length && now - points[0].t >= fade) points.shift()

  ctx.clearRect(0, 0, width, height)
  ctx.save()
  if (edgeClipPath) ctx.clip(edgeClipPath, 'evenodd')

  for (const point of points) {
    const life = 1 - (now - point.t) / fade
    const alpha = strength * point.s * life
    if (alpha <= MIN_VISIBLE_ALPHA) continue
    const radius = size * (0.5 + life * 0.5)
    const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius)
    gradient.addColorStop(0, `rgba(${glowRgb}, ${clamp(alpha, 0, 1)})`)
    gradient.addColorStop(1, `rgba(${glowRgb}, 0)`)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  if (points.length) raf = requestAnimationFrame(draw)
}

// Pointer handler updates trail and smooths motion to avoid spikes.
// Two-stage smoothing:
// 1) speedEma smooths noisy pointer event deltas
// 2) motionLevel uses slower rise/fall for a softer visual response
const onMove = (event: PointerEvent) => {
  if (!host) return
  if (!edgeClipPath) scheduleGeometrySync()

  const now = performance.now()
  const x = clamp(event.clientX - hostLeft, 0, width)
  const y = clamp(event.clientY - hostTop, 0, height)
  const dt = now - lastT
  const dtMs = clamp(dt || FRAME_MS, MIN_DELTA_MS, MAX_DELTA_MS)
  const distance = lastT ? Math.hypot(x - lastX, y - lastY) : 0
  const rawSpeed = distance < JITTER_PX ? 0 : Math.min(MAX_STEP_DISTANCE_PX, distance) / dtMs

  // First-stage EMA smooths noisy event-to-event speed.
  speedEma += (rawSpeed - speedEma) * (1 - Math.exp(-dtMs / SPEED_EMA_TIME_MS))

  const sensitivity = Math.max(0, props.movementSensitivity)
  const targetMotion = lastT && dt < STALE_EVENT_MS ? clamp(speedEma * sensitivity, 0, 1) : 0
  // Second-stage smoothing with asymmetric rise/fall for softer ramping.
  const riseAlpha = 1 - Math.exp(-dtMs / MOTION_RISE_TIME_MS)
  const fallAlpha = 1 - Math.exp(-dtMs / MOTION_FALL_TIME_MS)
  motionLevel += (targetMotion - motionLevel) * (targetMotion > motionLevel ? riseAlpha : fallAlpha)

  points.push({ x, y, t: now, s: Math.max(MIN_POINT_STRENGTH, motionLevel * motionLevel) })
  lastX = x
  lastY = y
  lastT = now

  // Keep enough samples to respect fade duration while capping memory.
  const fadeBudget = Math.ceil(Math.max(MIN_DELTA_MS, props.fadeMs) / FRAME_MS)
  const pointLimit = Math.min(MAX_POINTS, Math.max(props.maxTrailPoints, fadeBudget))
  if (points.length > pointLimit) points.splice(0, points.length - pointLimit)

  if (!raf) raf = requestAnimationFrame(draw)
}

const resetState = () => {
  points = []
  lastT = 0
  speedEma = 0
  motionLevel = 0
  cutoutPath = null
  edgeClipPath = null
  if (ctx) ctx.clearRect(0, 0, width, height)
  if (raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
  if (geometryRaf) {
    cancelAnimationFrame(geometryRaf)
    geometryRaf = 0
  }
  if (geometrySettleRaf) {
    cancelAnimationFrame(geometrySettleRaf)
    geometrySettleRaf = 0
  }
}

// Rebind whenever host changes so listeners and geometry always stay correct.
const bindHost = () => {
  if (host) host.removeEventListener('pointermove', onMove)
  if (resizeObserver && host) resizeObserver.unobserve(host)
  if (resizeObserver && observedCutoutElement) {
    resizeObserver.unobserve(observedCutoutElement)
    observedCutoutElement = null
  }

  host = props.hostElement
  resetState()
  if (!host) return

  host.addEventListener('pointermove', onMove, { passive: true })
  if (resizeObserver) resizeObserver.observe(host)
  syncGlowColor()
  syncGeometry()
  runStartupGeometrySync()
}

watch(() => props.hostElement, bindHost, { immediate: true })
watch(() => props.glowColorRgb, syncGlowColor)

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      scheduleGeometrySync()
    })
    if (host) resizeObserver.observe(host)
  }

  syncGlowColor()
  syncGeometry()
  runStartupGeometrySync()
  window.addEventListener('resize', scheduleGeometrySync)
})

onUnmounted(() => {
  if (host) host.removeEventListener('pointermove', onMove)
  window.removeEventListener('resize', scheduleGeometrySync)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  observedCutoutElement = null
  resetState()
})
</script>

<template>
  <canvas ref="canvas" class="mouseRingGlow" aria-hidden="true"></canvas>
</template>

<style scoped>
.mouseRingGlow {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
</style>
