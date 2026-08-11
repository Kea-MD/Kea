import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ContextMenu } from '../../src/shared/ContextMenu'

describe('ContextMenu', () => {
  it('renders actions in a portal and invokes the selected action', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<ContextMenu x={24} y={32} label="File actions" onClose={onClose} items={[{ id: 'open', label: 'Open', shortcut: '⌘O', onSelect }]} />)

    expect(screen.getByRole('menu', { name: 'File actions' }).classList.contains('select-none')).toBe(true)
    expect(screen.getByText('⌘O')).not.toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: /Open/ }))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('moves through enabled actions with the keyboard and closes on Escape', () => {
    const onClose = vi.fn()
    render(<ContextMenu x={24} y={32} label="File actions" onClose={onClose} items={[
      { id: 'open', label: 'Open', onSelect: () => {} },
      { type: 'separator' },
      { id: 'rename', label: 'Rename', onSelect: () => {} },
    ]} />)

    const open = screen.getByRole('menuitem', { name: 'Open' })
    const rename = screen.getByRole('menuitem', { name: 'Rename' })
    expect(document.activeElement).toBe(open)

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(rename)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
