import { useEffect, useMemo, useRef, useState } from 'react'
import type { WorkspaceFileEntry } from '../core/contracts/workspace'

function flattenMarkdown(entries: WorkspaceFileEntry[]): WorkspaceFileEntry[] {
  return entries.flatMap(entry => entry.is_dir ? flattenMarkdown(entry.children ?? []) : entry.is_markdown ? [entry] : [])
}

function score(candidate: string, query: string): number {
  if (!query) return 0
  const value = candidate.toLowerCase()
  let cursor = 0
  let points = 0
  for (const character of query.toLowerCase()) {
    const found = value.indexOf(character, cursor)
    if (found < 0) return Number.NEGATIVE_INFINITY
    points += found === cursor ? 3 : 1
    if (found === 0 || /[\s/_.-]/.test(value[found - 1] ?? '')) points += 4
    cursor = found + 1
  }
  return points - value.length / 100
}

export function QuickOpenDialog({ entries, rootPath, onOpen, onClose }: {
  entries: WorkspaceFileEntry[]
  rootPath: string | null
  onOpen: (path: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const files = useMemo(() => flattenMarkdown(entries).map(file => ({
    ...file,
    relativePath: rootPath && file.path.startsWith(rootPath) ? file.path.slice(rootPath.length).replace(/^[\\/]/, '') : file.path,
  })), [entries, rootPath])
  const results = useMemo(() => files
    .map(file => ({ file, score: score(`${file.name} ${file.relativePath}`, query) }))
    .filter(result => Number.isFinite(result.score))
    .sort((a, b) => b.score - a.score || a.file.relativePath.localeCompare(b.file.relativePath))
    .slice(0, 50), [files, query])

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setSelected(0) }, [query])

  const choose = (): void => {
    const path = results[selected]?.file.path
    if (path) { onOpen(path); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 pt-[12vh] backdrop-blur-[2px]" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="w-[min(620px,calc(100vw-32px))] overflow-hidden rounded-xl border border-[var(--react-border)] bg-[var(--react-panel-background)] shadow-2xl" role="dialog" aria-modal="true" aria-label="Quick Open">
        <div className="flex items-center gap-2 border-b border-[var(--react-border)] px-3">
          <span className="material-symbols-outlined !text-[20px]">search</span>
          <input ref={inputRef} className="h-12 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" value={query} placeholder="Search Markdown files…" aria-label="Search files" onChange={event => setQuery(event.target.value)} onKeyDown={event => {
            if (event.key === 'Escape') onClose()
            if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(value => Math.min(value + 1, results.length - 1)) }
            if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(value => Math.max(value - 1, 0)) }
            if (event.key === 'Enter') { event.preventDefault(); choose() }
          }} />
          <kbd className="rounded border border-[var(--react-border)] px-1.5 py-0.5 text-[10px]">esc</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-1.5">
          {results.map(({ file }, index) => <button key={file.path} type="button" className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${index === selected ? 'bg-[var(--react-hover-background)]' : 'bg-transparent'}`} onMouseEnter={() => setSelected(index)} onClick={() => { onOpen(file.path); onClose() }}>
            <span className="material-symbols-outlined !text-[18px]">markdown</span>
            <span className="font-medium">{file.name}</span>
            <span className="ml-auto min-w-0 truncate text-xs text-[var(--react-dark-500)]">{file.relativePath}</span>
          </button>)}
          {!results.length && <p className="m-0 px-3 py-8 text-center text-sm text-[var(--react-dark-500)]">No matching Markdown files</p>}
        </div>
      </section>
    </div>
  )
}
