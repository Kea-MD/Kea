import { useMemo } from 'react'
import { extractMarkdownHeadings } from './markdownHeadings'

export function DocumentOutline({ content, onReveal, onClose }: { content: string; onReveal: (position: number) => void; onClose: () => void }) {
  const headings = useMemo(() => extractMarkdownHeadings(content), [content])
  return (
    <aside className="absolute bottom-3 right-3 top-3 z-20 flex w-[min(310px,calc(100%-24px))] flex-col overflow-hidden rounded-xl border border-[var(--react-border)] bg-[var(--react-panel-background)] shadow-xl" aria-label="Document outline">
      <header className="flex h-10 items-center border-b border-[var(--react-border)] px-3 text-xs font-semibold uppercase tracking-wide">
        Outline
        <button type="button" className="ml-auto rounded p-1 hover:bg-[var(--react-hover-background)]" aria-label="Close outline" onClick={onClose}><span className="material-symbols-outlined !text-[18px]">close</span></button>
      </header>
      <nav className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {headings.map(heading => <button key={`${heading.position}-${heading.anchor}`} type="button" className="block w-full truncate rounded-md bg-transparent py-1.5 pr-2 text-left text-xs hover:bg-[var(--react-hover-background)]" style={{ paddingLeft: 8 + (heading.level - 1) * 12 }} title={heading.text} onClick={() => onReveal(heading.position)}>{heading.text}</button>)}
        {!headings.length && <p className="px-3 py-6 text-center text-xs text-[var(--react-dark-500)]">Add headings to build an outline.</p>}
      </nav>
    </aside>
  )
}
