import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AppIcon, type AppIconName } from '../ui/AppIcon'

export interface ContextMenuAction {
  id: string
  label: string
  icon?: AppIconName
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  onSelect: () => void | Promise<unknown>
}

export interface ContextMenuSeparator {
  type: 'separator'
}

export type ContextMenuItem = ContextMenuAction | ContextMenuSeparator

export interface ContextMenuProps {
  x: number
  y: number
  label: string
  items: ContextMenuItem[]
  onClose: () => void
}

function isSeparator(item: ContextMenuItem): item is ContextMenuSeparator {
  return 'type' in item && item.type === 'separator'
}

export function ContextMenu({ x, y, label, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    const margin = 8
    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin)),
    })
  }, [x, y, items.length])

  useEffect(() => {
    const firstAction = menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    firstAction?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const actions = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const index = actions.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowDown' && actions.length > 0) {
        event.preventDefault()
        actions[(index + 1) % actions.length]?.focus()
      } else if (event.key === 'ArrowUp' && actions.length > 0) {
        event.preventDefault()
        actions[(index - 1 + actions.length) % actions.length]?.focus()
      } else if (event.key === 'Home' && actions.length > 0) {
        event.preventDefault()
        actions[0]?.focus()
      } else if (event.key === 'End' && actions.length > 0) {
        event.preventDefault()
        actions[actions.length - 1]?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const menu = (
    <div
      ref={menuRef}
      className="fixed z-[2000] grid min-w-[188px] max-w-[280px] select-none rounded-[10px] border border-white/[0.12] bg-[rgba(32,33,38,0.96)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.28),0_1px_2px_rgba(0,0,0,0.2)] backdrop-blur-[18px]"
      role="menu"
      aria-label={label}
      style={{ left: position.left, top: position.top }}
      onContextMenu={event => event.preventDefault()}
    >
      {items.map((item, index) => {
        if (isSeparator(item)) return <div key={`separator-${index}`} className="my-1 h-px bg-white/10" role="separator" />
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`flex min-h-7 w-full items-center gap-2 rounded-[6px] bg-transparent px-2 py-1.5 text-left text-[12px] leading-4 transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-35${item.danger ? ' text-[rgb(var(--react-brand-rgb))] hover:bg-[rgba(var(--react-brand-rgb),0.16)]' : ' text-white/90'}`}
            onClick={() => {
              if (item.disabled) return
              onClose()
              void item.onSelect()
            }}
          >
            {item.icon && <AppIcon name={item.icon} />}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.shortcut && <span className="ml-3 whitespace-nowrap rounded-[4px] bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-medium leading-3 text-white/45">{item.shortcut}</span>}
          </button>
        )
      })}
    </div>
  )

  return createPortal(menu, document.body)
}
