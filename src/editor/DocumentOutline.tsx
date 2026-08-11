import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { extractMarkdownHeadings } from './markdownHeadings'

const RAIL_EDGE_INSET = 12
const RAIL_HIT_WIDTH = 22
const TICK_WIDTH = 11
const TICK_HEIGHT = 2
const TICK_GAP = 7
const POPOVER_WIDTH = 260

export function DocumentOutline({ content, activePosition, onReveal }: { content: string; activePosition: number | null; onReveal: (position: number) => void }) {
  const headings = useMemo(() => extractMarkdownHeadings(content), [content])
  const [isOpen, setIsOpen] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!headings.length) return null

  const tickStackHeight = headings.length * TICK_HEIGHT + Math.max(0, headings.length - 1) * TICK_GAP
  const keepOpenWhenMovingBetweenSurfaces = (event: MouseEvent<HTMLElement>, surface: HTMLElement | null) => {
    const next = event.relatedTarget
    if (next instanceof Node && surface?.contains(next)) return
    setIsOpen(false)
  }

  return (
    <div className="document-outline absolute inset-y-0 right-0 z-20 w-[272px]" aria-label="Document outline">
      <div
        ref={railRef}
        className="document-outline-rail absolute right-6 top-1/2 -translate-y-1/2"
        style={{ width: RAIL_HIT_WIDTH, height: tickStackHeight }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={event => keepOpenWhenMovingBetweenSurfaces(event, popoverRef.current)}
      >
        <nav
          className="document-outline-ticks absolute right-0 top-1/2 flex -translate-y-1/2 flex-col"
          data-open={isOpen ? 'true' : 'false'}
          style={{ gap: TICK_GAP }}
          aria-label="Document sections"
        >
          {headings.map(heading => (
            <button
              key={`${heading.position}-${heading.anchor}`}
              type="button"
              className={`document-outline-tick block cursor-default border-0 bg-[currentColor] p-0 opacity-40${heading.position === activePosition ? ' is-active' : ''}`}
              style={{ width: TICK_WIDTH, height: TICK_HEIGHT }}
              title={heading.text}
              aria-label={heading.text}
              aria-current={heading.position === activePosition ? 'location' : undefined}
              onFocus={() => setIsOpen(true)}
              onMouseDown={event => event.preventDefault()}
              onClick={() => onReveal(heading.position)}
            />
          ))}
        </nav>
      </div>

      <aside
        ref={popoverRef}
        className={`document-outline-popover pointer-events-auto absolute top-1/2 overflow-hidden rounded-xl border border-[var(--react-border)] bg-[var(--react-panel-background)] shadow-xl${isOpen ? ' is-open' : ''}`}
        style={{ right: RAIL_EDGE_INSET, width: POPOVER_WIDTH }}
        aria-hidden={!isOpen}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={event => keepOpenWhenMovingBetweenSurfaces(event, railRef.current)}
      >
        <nav className="max-h-[70vh] overflow-y-auto px-4 py-3" aria-label="Outline headings">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {headings.map(heading => (
              <li key={`${heading.position}-${heading.anchor}`}>
                <button
                  type="button"
                  className={`document-outline-row block w-full truncate border-0 bg-transparent p-0 text-left text-[13px] leading-[1.5] text-[var(--react-dark-500)]${heading.position === activePosition ? ' is-active' : ''}`}
                  style={{ paddingLeft: (heading.level - 1) * 12 }}
                  title={heading.text}
                  aria-current={heading.position === activePosition ? 'location' : undefined}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => onReveal(heading.position)}
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  )
}
