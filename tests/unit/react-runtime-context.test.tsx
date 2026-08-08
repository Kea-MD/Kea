import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimePort } from '../../src/core/contracts'
import { RuntimeProvider, useRuntimeContext } from '../../src/runtime/RuntimeContext'

function Consumer() {
  const runtime = useRuntimeContext()
  return <output>{JSON.stringify(runtime)}</output>
}

function createPort(initial = { isTauri: true, isMac: true, isMobile: false }) {
  let mobileListener: ((value: boolean) => void) | undefined
  let windowListener: (() => void) | undefined
  const removeMobile = vi.fn()
  const removeWindow = vi.fn()
  const readFullscreen = vi.fn().mockResolvedValue(false)
  const port: RuntimePort = {
    getInitialContext: () => initial,
    readFullscreen,
    subscribeMobile: (listener) => {
      mobileListener = listener
      return removeMobile
    },
    subscribeWindowState: async (listener) => {
      windowListener = listener
      return removeWindow
    },
  }
  return { port, emitMobile: (value: boolean) => mobileListener?.(value), emitResize: () => windowListener?.(), removeMobile, removeWindow, readFullscreen }
}

describe('React runtime context', () => {
  it('derives traffic-light inset from runtime and mobile state', async () => {
    const fake = createPort()
    await act(async () => {
      render(<RuntimeProvider port={fake.port}><Consumer /></RuntimeProvider>)
    })
    expect(JSON.parse(screen.getByText(/isTauri/).textContent ?? '').hasTrafficLightsInset).toBe(true)

    await act(async () => {
      fake.emitMobile(true)
    })
    expect(JSON.parse(screen.getByText(/isTauri/).textContent ?? '').hasTrafficLightsInset).toBe(false)
  })

  it('updates fullscreen state after a window resize and cleans listeners', async () => {
    const fake = createPort()
    fake.readFullscreen.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const view = render(<RuntimeProvider port={fake.port}><Consumer /></RuntimeProvider>)
    await act(async () => {})
    act(() => fake.emitResize())
    await act(async () => {})
    expect(JSON.parse(screen.getByText(/isTauri/).textContent ?? '').isFullscreen).toBe(true)
    view.unmount()
    expect(fake.removeMobile).toHaveBeenCalledOnce()
    expect(fake.removeWindow).toHaveBeenCalledOnce()
  })

  it('rejects hook use outside the provider', () => {
    function InvalidConsumer() {
      useRuntimeContext()
      return null
    }
    expect(() => render(<InvalidConsumer />)).toThrow('within a RuntimeProvider')
  })
})
