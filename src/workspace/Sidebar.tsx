import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { findEntry, type WorkspaceFileEntry } from './workspaceModel'
import type { WorkspaceController } from './useWorkspaceController'
import { FileTree } from './FileTree'
import type { DocumentSnapshot } from '../core/contracts/document'

function Icon({ children }: { children: string }) { return <span className="material-symbols-outlined" aria-hidden="true">{children}</span> }

export interface SidebarProps {
  controller: WorkspaceController
  width: number
  activePath: string | null
  onSelectFile: (path: string) => void
  onPathChanged: (oldPath: string, newPath: string | null, isDirectory?: boolean) => void
  onNewFile: () => void
  onOpenFile: () => void
  onSaveFile: () => void
  canSave: boolean
  isSaving: boolean
  openDocuments: DocumentSnapshot[]
  onCloseDocuments: (ids: string[]) => Promise<void>
  onSettings: () => void
  isOpen: boolean
  isHovering: boolean
}

export function Sidebar({ controller, width, activePath, onSelectFile, onPathChanged, onNewFile, onOpenFile, onSaveFile, canSave, isSaving, openDocuments, onCloseDocuments, onSettings, isOpen, isHovering }: SidebarProps) {
  const [renamePath, setRenamePath] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ entry: WorkspaceFileEntry; x: number; y: number } | null>(null)
  const hasChanges = openDocuments.some(document => document.isDirty)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (menu) menuRef.current?.focus() }, [menu])
  useEffect(() => {
    const closeMenu = () => setMenu(null)
    document.addEventListener('click', closeMenu)
    return () => document.removeEventListener('click', closeMenu)
  }, [])
  const open = () => void controller.openFolder()
  const rename = async (path: string, name: string): Promise<boolean> => { const entry = findEntry(controller.entries, path); const result = await controller.renameItem(path, name); if (result) onPathChanged(path, result, entry?.is_dir); setRenamePath(null); return Boolean(result) }
  const requestRename = (path: string) => {
    setRenamePath(path)
    window.setTimeout(() => setRenamePath(current => current === path ? null : current), 0)
  }
  const getNextUntitledName = (parentPath: string, folder: boolean): string => {
    const parent = parentPath === controller.rootPath ? null : findEntry(controller.entries, parentPath)
    const existingNames = new Set((parent?.children ?? (parentPath === controller.rootPath ? controller.entries : [])).map(entry => entry.name.toLowerCase()))
    const base = folder ? 'untitled' : 'untitled.md'
    if (!existingNames.has(base)) return base
    let index = 1
    while (existingNames.has(folder ? `untitled-${index}` : `untitled-${index}.md`)) index += 1
    return folder ? `untitled-${index}` : `untitled-${index}.md`
  }
  const createAndRename = async (parentPath: string, folder: boolean) => {
    setMenu(null)
    const name = getNextUntitledName(parentPath, folder)
    const entry = folder ? await controller.createFolder(parentPath, name) : await controller.createFile(parentPath, name)
    if (entry) requestRename(entry.path)
  }
  const pathMatches = (path: string, target: string, isDirectory: boolean) => path === target || (isDirectory && (path.startsWith(`${target}/`) || path.startsWith(`${target}\\`)))
  const deleteEntry = async (path: string) => {
    const entry = findEntry(controller.entries, path)
    if (!entry) return
    const affected = openDocuments.filter(document => pathMatches(document.path, path, entry.is_dir))
    const unsaved = affected.filter(document => document.isDirty)
    let message = entry.is_dir ? `Delete folder "${entry.name}" and all contents?` : `Delete file "${entry.name}"?`
    if (affected.length > 0) message += `\n\nThis will close ${affected.length} open file${affected.length === 1 ? '' : 's'}.`
    if (unsaved.length > 0) message += `\n${unsaved.length} open file${unsaved.length === 1 ? '' : 's'} ha${unsaved.length === 1 ? 's' : 've'} unsaved changes that will be lost.`
    if (!window.confirm(message)) return
    await onCloseDocuments(affected.map(document => document.id))
    const ok = await controller.deleteItem(path)
    if (ok) onPathChanged(path, null, entry.is_dir)
    setMenu(null)
  }
  const contextMenu = (event: MouseEvent, entry: WorkspaceFileEntry) => { event.preventDefault(); setMenu({ entry, x: event.clientX, y: event.clientY }) }
  return <div className={`relative z-4 w-0 overflow-visible pointer-events-none transition-[width] duration-[160ms] [transition-timing-function:cubic-bezier(0,0,0.58,1)] react-sidebar-host${isOpen ? ' is-open' : ''}${isHovering ? ' is-hovering' : ''}`} style={isOpen ? { width } : undefined}>
   <div className={`react-safety-triangle${isHovering && !isOpen ? ' is-active' : ''}`} />
   <aside className="react-sidebar absolute left-[5px] top-[88px] z-4 h-[calc(100%-93px)] min-w-0 overflow-hidden rounded-[25px] p-2.5 text-[rgba(163,163,168,1)] opacity-0 -translate-x-full bg-transparent transition-[transform,backdrop-filter,opacity,background,top,height] duration-[160ms] [transition-timing-function:cubic-bezier(0.42,0,1,1)]" style={{ width: width - 10 }} aria-label="Navigation" onClick={() => menu && setMenu(null)}>
     <div className="grid h-full w-full grid-rows-[1fr_auto] overflow-hidden rounded-[25px]">
       <nav className="flex min-h-0 flex-col overflow-hidden px-2 text-sm" aria-label="Navigation">
         <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
           <span className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white/90${controller.rootName ? '' : ' italic font-normal text-white/40'}`}>{controller.rootName ?? 'No folder open'}</span>
           <div className="flex flex-none gap-0.5">
             <button type="button" className="inline-flex items-center justify-center rounded bg-transparent p-1 text-white/50 transition-all duration-150 hover:bg-white/10 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-30" onClick={onNewFile} title="New File (⌘N)" aria-label="New File"><i className="pi pi-plus text-sm" /></button>
             <button type="button" className="inline-flex items-center justify-center rounded bg-transparent p-1 text-white/50 transition-all duration-150 hover:bg-white/10 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-30" onClick={onOpenFile} title="Open File (⌘O)" aria-label="Open File"><i className="pi pi-file text-sm" /></button>
             <button type="button" className="inline-flex items-center justify-center rounded bg-transparent p-1 text-white/50 transition-all duration-150 hover:bg-white/10 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-30" onClick={open} title="Open Folder (⌘⇧O)" aria-label="Open Folder"><i className="pi pi-folder-open text-sm" /></button>
             <button type="button" className={`inline-flex items-center justify-center rounded bg-transparent p-1 text-white/50 transition-all duration-150 hover:bg-white/10 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-30${hasChanges ? ' text-[rgb(var(--react-brand-rgb))] hover:bg-[rgba(var(--react-brand-rgb),0.2)]' : ''}`} disabled={!canSave || isSaving} onClick={onSaveFile} title="Save (⌘S)" aria-label="Save"><i className="pi pi-save text-sm" /></button>
           </div>
         </div>
         {controller.loading && <p className="p-3 text-xs text-white/40" role="status">Loading workspace…</p>}
         {controller.error && <div className="m-1 flex items-center gap-2 rounded-[7px] border border-[rgba(180,35,24,0.24)] p-2 text-xs text-[#b42318]" role="alert"><span>{controller.error}</span><button type="button" className="ml-auto rounded-[7px] border border-white/10 bg-transparent px-1.5 py-[3px] text-white/80 hover:bg-white/10" onClick={() => { controller.clearError(); open() }}>Retry</button></div>}
         {!controller.rootPath && !controller.loading && <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-white/40"><p className="m-0 text-[13px]">Open a folder to browse files</p></div>}
         {controller.rootPath && <FileTree entries={controller.entries} rootPath={controller.rootPath} expandedPaths={controller.expandedPaths} activePath={activePath} renamePath={renamePath} onToggle={path => void controller.toggleFolder(path)} onSelectFile={onSelectFile} onRename={rename} onRenameRequest={setRenamePath} onContextMenu={contextMenu} onMove={async (source, target) => { const result = await controller.moveItem(source, target); if (result) onPathChanged(source, result, controller.entries.find(item => item.path === source)?.is_dir) }} />}
       </nav>
        <footer className="flex items-center border-t border-white/10 p-3"><button type="button" className="flex h-[30px] w-[30px] items-center justify-center rounded bg-transparent p-0 text-white/50 transition-all duration-150 hover:bg-white/10 hover:text-white/90" aria-label="Settings" title="Settings" onClick={onSettings}><Icon>settings</Icon></button></footer>
     </div>
     {menu && <div ref={menuRef} className="fixed z-[1000] grid min-w-[160px] rounded-lg border border-white/10 bg-[rgba(30,30,30,0.95)] p-1 shadow-[0_4px_12px_rgba(0,0,0,0.3)] backdrop-blur-[10px]" role="menu" tabIndex={-1} aria-label={`Actions for ${menu.entry.name}`} style={{ left: menu.x, top: menu.y }} onKeyDown={event => { if (event.key === 'Escape') setMenu(null) }} onClick={event => event.stopPropagation()}>
        {menu.entry.is_dir && <><button type="button" className="flex w-full items-center gap-2 rounded bg-transparent px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10" role="menuitem" onClick={() => void createAndRename(menu.entry.path, false)}><i className="pi pi-file" />New File</button><button type="button" className="flex w-full items-center gap-2 rounded bg-transparent px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10" role="menuitem" onClick={() => void createAndRename(menu.entry.path, true)}><i className="pi pi-folder" />New Folder</button><div className="my-1 h-px bg-white/10" /></>}
        <button type="button" className="flex w-full items-center gap-2 rounded bg-transparent px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10" role="menuitem" onClick={() => { setMenu(null); requestRename(menu.entry.path) }}><i className="pi pi-pencil" />Rename</button>
        <button type="button" className="flex w-full items-center gap-2 rounded bg-transparent px-3 py-2 text-left text-sm text-[rgb(var(--react-brand-rgb))] hover:bg-[rgba(var(--react-brand-rgb),0.2)]" role="menuitem" onClick={() => void deleteEntry(menu.entry.path)}><i className="pi pi-trash" />Delete</button>
    </div>}
  </aside>
  </div>
}
