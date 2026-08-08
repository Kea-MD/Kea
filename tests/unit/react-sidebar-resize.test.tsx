import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSidebarResize } from '../../src/workspace/useSidebarResize'

function Harness() {
  const resize = useSidebarResize()
  return (
    <div>
      <button type="button" onMouseDown={resize.startResize}>Resize</button>
      <output data-testid="width">{resize.sidebarWidth}</output>
      <output data-testid="resizing">{String(resize.isResizing)}</output>
    </div>
  )
}

describe('React sidebar resize', () => {
  beforeEach(() => window.localStorage.clear())

  it('clamps, persists, and cleans up the resize interaction', () => {
    render(<Harness />)
    act(() => { fireEvent.mouseDown(screen.getByRole('button', { name: 'Resize' }), { clientX: 100 }) })
    expect(screen.getByTestId('resizing').textContent).toBe('true')

    act(() => { fireEvent.mouseMove(document, { clientX: 250 }) })
    expect(screen.getByTestId('width').textContent).toBe('410')

    act(() => { fireEvent.mouseUp(document) })
    expect(screen.getByTestId('resizing').textContent).toBe('false')
    expect(window.localStorage.getItem('kea-sidebar-width')).toBe('410')
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })
})
