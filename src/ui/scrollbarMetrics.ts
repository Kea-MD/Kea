export interface ScrollbarMetricsInput {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  pathLength: number
  minimumThumbLength: number
}

export interface ScrollbarMetrics {
  visible: boolean
  progress: number
  thumbFraction: number
  startFraction: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function calculateScrollbarMetrics({
  scrollTop,
  scrollHeight,
  clientHeight,
  pathLength,
  minimumThumbLength,
}: ScrollbarMetricsInput): ScrollbarMetrics {
  const maximumScrollTop = Math.max(0, scrollHeight - clientHeight)
  if (maximumScrollTop <= 0.5 || pathLength <= 0 || clientHeight <= 0) {
    return { visible: false, progress: 0, thumbFraction: 1, startFraction: 0 }
  }

  const progress = clamp(scrollTop / maximumScrollTop, 0, 1)
  const viewportFraction = clamp(clientHeight / scrollHeight, 0, 1)
  const minimumFraction = clamp(minimumThumbLength / pathLength, 0, 1)
  const thumbFraction = Math.max(viewportFraction, minimumFraction)

  return {
    visible: true,
    progress,
    thumbFraction,
    startFraction: progress * (1 - thumbFraction),
  }
}
