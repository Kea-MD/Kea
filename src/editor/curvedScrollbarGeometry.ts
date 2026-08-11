export interface PerimeterPathInput {
  width: number
  height: number
  radius: number
  inset: number
  curveTop: boolean
}

export interface PerimeterPathGeometry {
  d: string
  length: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function coordinate(value: number): string {
  return Number(value.toFixed(2)).toString()
}

export function buildPerimeterPath({
  width,
  height,
  radius,
  inset,
  curveTop,
}: PerimeterPathInput): PerimeterPathGeometry {
  if (width <= 0 || height <= 0) return { d: '', length: 0 }

  const safeInset = clamp(inset, 0, Math.min(width, height) / 2)
  const right = Math.max(safeInset, width - safeInset)
  const bottom = Math.max(safeInset, height - safeInset)
  const availableWidth = Math.max(0, right - safeInset)
  const availableHeight = Math.max(0, bottom - safeInset)
  const safeRadius = clamp(radius - safeInset, 0, Math.min(availableWidth, availableHeight) / 2)
  const cornerX = right - safeRadius
  const topCornerY = safeInset + safeRadius
  const bottomCornerY = bottom - safeRadius
  const quarterArcLength = Math.PI * safeRadius / 2

  if (curveTop) {
    const verticalLength = Math.max(0, bottomCornerY - topCornerY)
    return {
      d: [
        `M ${coordinate(cornerX)} ${coordinate(safeInset)}`,
        `A ${coordinate(safeRadius)} ${coordinate(safeRadius)} 0 0 1 ${coordinate(right)} ${coordinate(topCornerY)}`,
        `V ${coordinate(bottomCornerY)}`,
        `A ${coordinate(safeRadius)} ${coordinate(safeRadius)} 0 0 1 ${coordinate(cornerX)} ${coordinate(bottom)}`,
      ].join(' '),
      length: quarterArcLength * 2 + verticalLength,
    }
  }

  const verticalLength = Math.max(0, bottomCornerY - safeInset)
  return {
    d: [
      `M ${coordinate(right)} ${coordinate(safeInset)}`,
      `V ${coordinate(bottomCornerY)}`,
      `A ${coordinate(safeRadius)} ${coordinate(safeRadius)} 0 0 1 ${coordinate(cornerX)} ${coordinate(bottom)}`,
    ].join(' '),
    length: verticalLength + quarterArcLength,
  }
}
