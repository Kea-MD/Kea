import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { WorkspaceFileEntry } from './workspaceModel'
import { validateItemName } from './workspaceModel'

interface Props {
  entry: WorkspaceFileEntry
  level: number
  expanded: boolean
  isExpanded: (path: string) => boolean
  activePath: string | null
  renamePath: string | null
  draggingPath: string | null
  dropTargetPath: string | null
  onToggle: (path: string) => void
  onSelect: (entry: WorkspaceFileEntry) => void
  onRename: (path: string, name: string) => Promise<boolean>
  onRenameRequest: (path: string) => void
  onContextMenu: (event: MouseEvent, entry: WorkspaceFileEntry) => void
  onPointerDragStart: (event: MouseEvent, path: string) => void
}

export function FileTreeItem({ entry, level, expanded, isExpanded, activePath, renamePath, draggingPath, dropTargetPath, onToggle, onSelect, onRename, onRenameRequest, onContextMenu, onPointerDragStart }: Props) {
  const [renaming, setRenaming] = useState(false)
  const [value, setValue] = useState(entry.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const renameSubmittingRef = useRef(false)
  useEffect(() => {
    if (renamePath === entry.path) { renameSubmittingRef.current = false; setRenaming(true) }
  }, [entry.path, renamePath])
  useEffect(() => { if (renaming) { inputRef.current?.focus(); inputRef.current?.select() } }, [renaming])

  const finishRename = async () => {
    if (renameSubmittingRef.current) return
    renameSubmittingRef.current = true
    const name = value.trim()
    if (!name || name === entry.name) { setRenaming(false); renameSubmittingRef.current = false; return }
    if (validateItemName(name)) { await onRename(entry.path, name) }
    setRenaming(false)
    renameSubmittingRef.current = false
  }
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (renaming) return
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(entry) }
    else if (event.key === 'ArrowRight' && entry.is_dir && !expanded) { event.preventDefault(); onToggle(entry.path) }
    else if (event.key === 'ArrowLeft' && entry.is_dir && expanded) { event.preventDefault(); onToggle(entry.path) }
    else if (event.key === 'F2') { event.preventDefault(); setValue(entry.name); onRenameRequest(entry.path) }
  }
  const dragStart = (event: MouseEvent<HTMLDivElement>) => {
    if (renaming || (event.target as HTMLElement).closest('button,input')) return
    onPointerDragStart(event, entry.path)
  }
  const isActive = activePath === entry.path
  const isOther = !entry.is_dir && !entry.is_markdown
  const iconClass = `pi react-tree-icon flex-none text-sm ${entry.is_dir || entry.is_markdown ? 'text-[rgb(var(--react-brand-rgb))]' : 'text-white/60'}`
  const itemClass = `flex w-full min-w-0 min-h-0 cursor-pointer items-center gap-1 rounded px-2 py-1 text-left text-white/80 transition-[background] duration-100 hover:bg-white/[0.08] hover:text-white${isActive ? ' bg-[rgba(var(--react-brand-rgb),0.3)] text-white hover:bg-[rgba(var(--react-brand-rgb),0.3)]' : ''}${isOther && !isActive ? ' opacity-50' : ''}${draggingPath === entry.path ? ' opacity-[.45]' : ''}${dropTargetPath === entry.path ? ' bg-[rgba(var(--react-brand-rgb),0.22)] shadow-[inset_0_0_0_1px_rgba(var(--react-brand-rgb),0.7)]' : ''}`
  return <li role="none">
    <div
        className={itemClass}
       style={{ paddingLeft: `${level * 16}px` }} role="treeitem" tabIndex={0} aria-level={level + 1}
       aria-expanded={entry.is_dir ? expanded : undefined} aria-selected={activePath === entry.path}
       data-entry-path={entry.path} data-entry-dir={entry.is_dir ? 'true' : 'false'}
       onKeyDown={keyDown} onClick={() => !renaming && onSelect(entry)} onContextMenu={event => onContextMenu(event, entry)}
       onDoubleClick={() => { if (!entry.is_dir) { setValue(entry.name); onRenameRequest(entry.path) } }} onMouseDown={dragStart}
    >
       {entry.is_dir ? <button type="button" className="inline-flex h-[18px] w-[18px] flex-none cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent p-0 text-inherit hover:bg-white/10" aria-label={expanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`} aria-expanded={expanded} onClick={event => { event.stopPropagation(); onToggle(entry.path) }}><i className={`pi ${expanded ? 'pi-chevron-down' : 'pi-chevron-right'} text-[10px]`} aria-hidden="true" /></button> : <span className="inline-flex h-[18px] w-[18px] flex-none" />}
        <i className={`${iconClass} ${entry.is_dir ? (expanded ? 'pi-folder-open' : 'pi-folder') : 'pi-file'}`} aria-hidden="true" />
       {renaming ? <input ref={inputRef} className="min-w-0 flex-1 rounded-[3px] border border-[rgb(var(--react-brand-rgb))] bg-[rgba(0,0,0,0.3)] px-1 py-0.5 text-inherit text-sm text-white outline-none" value={value} aria-label={`Rename ${entry.name}`} onChange={event => setValue(event.target.value)} onBlur={() => void finishRename()} onClick={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter') void finishRename(); if (event.key === 'Escape') setRenaming(false) }} /> : <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{entry.name}</span>}
    </div>
      {entry.is_dir && expanded && entry.children && <ul className="m-0 list-none p-0" role="group">{entry.children.map(child => <FileTreeItem key={child.path} {...{ ...({ entry: child, level: level + 1, expanded: isExpanded(child.path), isExpanded, activePath, renamePath, draggingPath, dropTargetPath, onToggle, onSelect, onRename, onRenameRequest, onContextMenu, onPointerDragStart } as Props) }} />)}</ul>}
  </li>
}
