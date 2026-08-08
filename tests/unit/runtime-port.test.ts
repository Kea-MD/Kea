import { beforeEach, describe, expect, it, vi } from 'vitest'

const isFullscreen = vi.hoisted(() => vi.fn())
const onResized = vi.hoisted(() => vi.fn())
const getCurrentWindow = vi.hoisted(() => vi.fn(() => ({ isFullscreen, onResized })))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow }))

import { webRuntimePort } from '../../src/adapters/web/runtimePort'
import { tauriRuntimePort } from '../../src/adapters/tauri/runtimePort'

function installMediaQuery(matches = false) {
  let handler: (() => void) | undefined
  const query = {
    matches,
    addEventListener: vi.fn((_event: string, next: () => void) => { handler = next }),
    removeEventListener: vi.fn(),
    addListener: vi.fn((_next: () => void) => {}),
    removeListener: vi.fn(),
  } as unknown as MediaQueryList
  vi.spyOn(window, 'matchMedia').mockReturnValue(query)
  return { query, emit: () => handler?.() }
}

describe('runtime ports', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, '__TAURI_INTERNALS__')
    isFullscreen.mockResolvedValue(false)
    onResized.mockResolvedValue(() => {})
  })

  it('provides web defaults and media query cleanup', () => {
    const media = installMediaQuery()
    expect(webRuntimePort.getInitialContext().isTauri).toBe(false)
    const listener = vi.fn()
    const remove = webRuntimePort.subscribeMobile(listener)
    media.emit()
    expect(media.query.addEventListener).toHaveBeenCalled()
    remove()
    expect(media.query.removeEventListener).toHaveBeenCalled()
    expect(getCurrentWindow).not.toHaveBeenCalled()
  })

  it('reads Tauri fullscreen and cleans resize listeners', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    const remove = vi.fn()
    onResized.mockResolvedValue(remove)
    expect(await tauriRuntimePort.readFullscreen()).toBe(false)
    const cleanup = await tauriRuntimePort.subscribeWindowState(() => {})
    cleanup()
    expect(getCurrentWindow).toHaveBeenCalled()
    expect(remove).toHaveBeenCalledOnce()
  })

  it('returns safe cleanup when Tauri subscription fails', async () => {
    onResized.mockRejectedValue(new Error('closed'))
    const cleanup = await tauriRuntimePort.subscribeWindowState(() => {})
    expect(() => cleanup()).not.toThrow()
  })
})
