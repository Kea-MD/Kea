import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { StraightOverlayScrollbar } from '../ui/StraightOverlayScrollbar'
import { AppIcon } from '../ui/AppIcon'
import { filterEntries, findEntry, getParentPath, pathMatches, type WorkspaceFileEntry } from './workspaceModel'
import { FileTreeItem } from './FileTreeItem'

interface Props {
  entries: WorkspaceFileEntry[]
  rootPath: string
  expandedPaths: Set<string>
  activePath: string | null
  renamePath: string | null
  onToggle: (path: string) => void
  onSelectFile: (path: string) => void
  onRename: (path: string, name: string) => Promise<boolean>
  onRenameRequest: (path: string) => void
  onContextMenu: (event: MouseEvent, entry: WorkspaceFileEntry) => void
  onMove: (source: string, target: string) => Promise<void>
}

interface DragState {
  sourcePath: string | null
  dropTargetPath: string | null
  isOverRoot: boolean
  startX: number
  startY: number
  hasMoved: boolean
}

const initialDragState: DragState = {
  sourcePath: null,
  dropTargetPath: null,
  isOverRoot: false,
  startX: 0,
  startY: 0,
  hasMoved: false,
}

export function FileTree({ entries, rootPath, expandedPaths, activePath, renamePath, onToggle, onSelectFile, onRename, onRenameRequest, onContextMenu, onMove }: Props) {
  const treeRef = useRef<HTMLUListElement>(null)
  const dragRef = useRef<DragState>(initialDragState)
  const [dragState, setDragState] = useState<DragState>(initialDragState)
  const [query, setQuery] = useState('')
  const [scrollElement, setScrollElement] = useState<HTMLUListElement | null>(null)
  const filteredEntries = useMemo(() => filterEntries(entries, query), [entries, query])
  const isSearching = query.trim().length > 0

  const setTreeElement = useCallback((element: HTMLUListElement | null) => {
    treeRef.current = element
    setScrollElement(element)
  }, [])

  useEffect(() => { setQuery('') }, [rootPath])

  const resetDragState = () => {
    dragRef.current = initialDragState
    setDragState(initialDragState)
  }

  const canDropInto = (targetDir: string): boolean => {
    const sourcePath = dragRef.current.sourcePath
    const source = sourcePath ? findEntry(entries, sourcePath) : null
    if (!sourcePath || !source || sourcePath === rootPath || sourcePath === targetDir || getParentPath(sourcePath) === targetDir) return false
    return !(source.is_dir && pathMatches(targetDir, sourcePath))
  }

  const updateDropTarget = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY)
    const folderElement = element instanceof Element ? element.closest<HTMLElement>('[data-entry-path][data-entry-dir="true"]') : null
    const folderPath = folderElement?.dataset.entryPath

    if (folderPath) {
      setDragState(current => ({ ...current, dropTargetPath: canDropInto(folderPath) ? folderPath : null, isOverRoot: false }))
      return
    }

    const isInsideTree = element instanceof Node && Boolean(treeRef.current?.contains(element))
    setDragState(current => ({ ...current, dropTargetPath: null, isOverRoot: isInsideTree && canDropInto(rootPath) }))
  }

  const handlePointerDragMove = (event: globalThis.MouseEvent) => {
    const current = dragRef.current
    if (!current.sourcePath) return
    const distanceX = Math.abs(event.clientX - current.startX)
    const distanceY = Math.abs(event.clientY - current.startY)
    if (!current.hasMoved) {
      if (distanceX < 4 && distanceY < 4) return
      current.hasMoved = true
      setDragState({ ...current })
    }
    event.preventDefault()
    updateDropTarget(event.clientX, event.clientY)
  }

  const suppressNextClick = () => {
    const handler = (event: globalThis.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      document.removeEventListener('click', handler, true)
    }
    document.addEventListener('click', handler, true)
    window.setTimeout(() => document.removeEventListener('click', handler, true), 0)
  }

  const handlePointerDragEnd = (event: globalThis.MouseEvent) => {
    document.removeEventListener('mousemove', handlePointerDragMove)
    document.removeEventListener('mouseup', handlePointerDragEnd)
    const current = dragRef.current
    if (!current.sourcePath || !current.hasMoved) {
      resetDragState()
      return
    }

    event.preventDefault()
    suppressNextClick()
    const target = current.dropTargetPath || (current.isOverRoot ? rootPath : null)
    resetDragState()
    if (target) void onMove(current.sourcePath, target)
  }

  const handlePointerDragStart = (event: MouseEvent, path: string) => {
    if (event.button !== 0) return
    event.preventDefault()
    const next = { ...initialDragState, sourcePath: path, startX: event.clientX, startY: event.clientY }
    dragRef.current = next
    setDragState(next)
    document.addEventListener('mousemove', handlePointerDragMove)
    document.addEventListener('mouseup', handlePointerDragEnd)
  }

  useEffect(() => () => {
    document.removeEventListener('mousemove', handlePointerDragMove)
    document.removeEventListener('mouseup', handlePointerDragEnd)
  })

  const onSelect = (entry: WorkspaceFileEntry) => {
    if (entry.is_dir) {
      onToggle(entry.path)
    } else if (entry.is_markdown) {
      onSelectFile(entry.path)
    }
  }

  const isExpanded = (path: string): boolean => {
    if (!isSearching) return expandedPaths.has(path)
    const entry = findEntry(filteredEntries, path)
    return Boolean(entry?.is_dir && entry.children && entry.children.length > 0)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex h-8 flex-none items-center gap-2 rounded-md border border-white/10 bg-black/10 px-2 text-white/60 focus-within:border-[rgba(var(--react-brand-rgb),0.7)] focus-within:text-white/90">
        <AppIcon name="search" />
        <input
          className="min-w-0 flex-1 select-text border-0 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
          type="search"
          value={query}
          placeholder="Search files…"
          aria-label="Search files"
          onChange={event => setQuery(event.target.value)}
        />
        {query && <button type="button" className="inline-flex h-5 w-5 flex-none items-center justify-center rounded bg-transparent p-0 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Clear file search" onClick={() => setQuery('')}><AppIcon name="close" /></button>}
      </div>
      {isSearching && filteredEntries.length === 0
        ? <p className="m-0 px-2 py-4 text-center text-xs text-white/40" role="status">No matching files</p>
        : <div className="relative min-h-0 flex-1">
            <ul
              ref={setTreeElement}
              className={`react-custom-scroll-source react-file-tree-list m-0 block h-full min-h-0 list-none overflow-y-auto rounded-md p-0 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden${dragState.isOverRoot ? ' is-drop-root bg-[rgba(var(--react-brand-rgb),0.12)] shadow-[inset_0_0_0_1px_rgba(var(--react-brand-rgb),0.55)]' : ''}${dragState.hasMoved ? ' is-pointer-dragging' : ''}`}
              style={{ scrollbarWidth: 'none' }}
              role="tree"
              aria-label="Workspace files"
            >
              {filteredEntries.map(entry => <FileTreeItem key={entry.path} entry={entry} level={0} expanded={isExpanded(entry.path)} isExpanded={isExpanded} activePath={activePath} renamePath={renamePath} draggingPath={dragState.sourcePath} dropTargetPath={dragState.dropTargetPath} onToggle={onToggle} onSelect={onSelect} onRename={onRename} onRenameRequest={onRenameRequest} onContextMenu={onContextMenu} onPointerDragStart={handlePointerDragStart} />)}
            </ul>
            <StraightOverlayScrollbar scrollElement={scrollElement} />
          </div>}
    </div>
  )
}
