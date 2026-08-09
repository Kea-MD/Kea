import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSidebarInteraction } from '../../src/workspace/useSidebarInteraction'

function Harness() {
  const sidebar = useSidebarInteraction()
  return (
    <div>
      <button type="button" onClick={sidebar.toggleSidebar}>Toggle</button>
      <button type="button" onMouseEnter={() => sidebar.handleSidebarHover(true)} onMouseLeave={() => sidebar.handleSidebarHover(false)}>Hover target</button>
      <output data-testid="state">{sidebar.sidebarOpen ? 'open' : sidebar.sidebarHovering ? 'hovering' : 'closed'}</output>
    </div>
  )
}

describe('React sidebar interaction', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.useRealTimers())

  it('opens and closes with the same delayed hover behaviour as the Vue shell', () => {
    vi.useFakeTimers()
    render(<Harness />)

    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Toggle' })) })
    expect(screen.getByTestId('state').textContent).toBe('open')

    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Toggle' })) })
    act(() => { fireEvent.mouseEnter(screen.getByRole('button', { name: 'Hover target' })) })
    expect(screen.getByTestId('state').textContent).toBe('closed')

    act(() => { vi.advanceTimersByTime(300) })
    act(() => { fireEvent.mouseEnter(screen.getByRole('button', { name: 'Hover target' })) })
    expect(screen.getByTestId('state').textContent).toBe('hovering')

    act(() => { fireEvent.mouseLeave(screen.getByRole('button', { name: 'Hover target' })) })
    expect(screen.getByTestId('state').textContent).toBe('hovering')
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.getByTestId('state').textContent).toBe('closed')
  })

  it('restores and persists the sidebar open state', () => {
    window.localStorage.setItem('kea-sidebar-open', 'true')
    const { unmount } = render(<Harness />)

    expect(screen.getByTestId('state').textContent).toBe('open')
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Toggle' })) })
    expect(window.localStorage.getItem('kea-sidebar-open')).toBe('false')
    unmount()
  })
})
