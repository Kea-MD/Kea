import { describe, expect, it } from 'vitest'
import {
  buildPerimeterPath,
} from '../../src/editor/curvedScrollbarGeometry'
import { calculateScrollbarMetrics } from '../../src/ui/scrollbarMetrics'

describe('curved editor scrollbar geometry', () => {
  it('wraps around both panel corners when the top chrome is hidden', () => {
    const path = buildPerimeterPath({
      width: 1000,
      height: 700,
      radius: 30,
      inset: 5,
      curveTop: true,
    })

    expect(path.d).toBe('M 970 5 A 25 25 0 0 1 995 30 V 670 A 25 25 0 0 1 970 695')
    expect(path.length).toBeCloseTo(718.54, 2)
  })

  it('starts vertically but keeps the bottom curve when the top chrome is visible', () => {
    const path = buildPerimeterPath({
      width: 1000,
      height: 700,
      radius: 30,
      inset: 5,
      curveTop: false,
    })

    expect(path.d).toBe('M 995 5 V 670 A 25 25 0 0 1 970 695')
    expect(path.length).toBeCloseTo(704.27, 2)
  })

  it('moves a proportional thumb through the complete curved path', () => {
    expect(calculateScrollbarMetrics({
      scrollTop: 600,
      scrollHeight: 2000,
      clientHeight: 800,
      pathLength: 760,
      minimumThumbLength: 34,
    })).toEqual({
      visible: true,
      progress: 0.5,
      thumbFraction: 0.4,
      startFraction: 0.3,
    })
  })

  it('enforces a usable minimum thumb and hides when content does not overflow', () => {
    expect(calculateScrollbarMetrics({
      scrollTop: 0,
      scrollHeight: 20_000,
      clientHeight: 500,
      pathLength: 500,
      minimumThumbLength: 34,
    }).thumbFraction).toBeCloseTo(0.068)

    expect(calculateScrollbarMetrics({
      scrollTop: 0,
      scrollHeight: 500,
      clientHeight: 500,
      pathLength: 500,
      minimumThumbLength: 34,
    }).visible).toBe(false)
  })

})
