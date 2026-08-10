import { useState, type MouseEvent } from 'react'
import { ContextMenu, type ContextMenuItem } from '../shared/ContextMenu'
import { findEntry, getParentPath, pathMatches, type WorkspaceFileEntry } from './workspaceModel'
import type { WorkspaceController } from './useWorkspaceController'
import { FileTree } from './FileTree'
import type { DocumentSnapshot } from '../core/contracts/document'
import { formatShortcutForDisplay } from '../modules/settings/shortcuts/shortcutRegistry'

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
  onCloseWorkspace: () => Promise<void>
  shortcuts?: Record<string, string>
  onSettings: () => void
  isOpen: boolean
  isHovering: boolean
}

export function Sidebar({ controller, width, activePath, onSelectFile, onPathChanged, onNewFile, onOpenFile, onSaveFile, canSave, isSaving, openDocuments, onCloseDocuments, onCloseWorkspace, shortcuts = {}, onSettings, isOpen, isHovering }: SidebarProps) {
  const [renamePath, setRenamePath] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ target: WorkspaceFileEntry | 'root'; x: number; y: number } | null>(null)
  const [movePath, setMovePath] = useState<string | null>(null)
  const hasChanges = openDocuments.some(document => document.isDirty)
  const shortcut = (id: string): string | undefined => {
    const binding = shortcuts[id]
    if (!binding) return undefined
    const formatted = formatShortcutForDisplay(binding)
    return formatted === 'Unassigned' ? undefined : formatted
  }
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
  const deleteEntry = async (path: string) => {
    const entry = findEntry(controller.entries, path)
    if (!entry) return
    const affected = openDocuments.filter(document => document.path === path || (entry.is_dir && pathMatches(document.path, path)))
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
  const contextMenu = (event: MouseEvent, entry: WorkspaceFileEntry) => { event.preventDefault(); setMenu({ target: entry, x: event.clientX, y: event.clientY }) }
  const contextMenuRoot = (event: MouseEvent) => { event.preventDefault(); if (controller.rootPath) setMenu({ target: 'root', x: event.clientX, y: event.clientY }) }
  const copyPath = async (path: string): Promise<void> => {
    try {
      await navigator.clipboard?.writeText(path)
    } catch (error) {
      console.error('Failed to copy path:', error)
    }
  }
  const copyRelativePath = async (path: string): Promise<void> => {
    const root = controller.rootPath
    if (!root) return
    const relative = path === root ? '' : pathMatches(path, root) ? path.slice(root.length).replace(/^[\\/]+/, '') : path
    await copyPath(relative.replace(/\\/g, '/'))
  }
  const move = async (sourcePath: string, targetDir: string): Promise<void> => {
    const entry = findEntry(controller.entries, sourcePath)
    if (!entry) return
    const newPath = await controller.moveItem(sourcePath, targetDir)
    if (newPath) onPathChanged(sourcePath, newPath, entry.is_dir)
    setMovePath(null)
  }
  const folders = (entries: WorkspaceFileEntry[], sourcePath: string): WorkspaceFileEntry[] => entries.flatMap(entry => {
    if (!entry.is_dir || entry.path === sourcePath || pathMatches(entry.path, sourcePath)) return []
    return [entry, ...(entry.children ? folders(entry.children, sourcePath) : [])]
  })
  const menuItems = (): ContextMenuItem[] => {
    if (!menu) return []
    if (menu.target === 'root') {
      const root = controller.rootPath
      if (!root) return []
      return [
        { id: 'new-file', label: 'New File', icon: 'pi-file', shortcut: shortcut('new_file'), onSelect: () => void createAndRename(root, false) },
        { id: 'new-folder', label: 'New Folder', icon: 'pi-folder', onSelect: () => void createAndRename(root, true) },
        { type: 'separator' },
        { id: 'refresh', label: 'Refresh Workspace', icon: 'pi-refresh', onSelect: () => controller.refreshDirectory() },
        { type: 'separator' },
        { id: 'copy-path', label: 'Copy Workspace Path', icon: 'pi-copy', onSelect: () => copyPath(root) },
        { id: 'reveal', label: 'Reveal in Finder', icon: 'pi-search', onSelect: () => controller.revealItem(root) },
        { type: 'separator' },
        { id: 'open-folder', label: 'Open Another Folder…', icon: 'pi-folder-open', shortcut: shortcut('open_folder'), onSelect: open },
        { id: 'close-workspace', label: 'Close Workspace', icon: 'pi-times', danger: true, onSelect: onCloseWorkspace },
      ]
    }

    const entry = menu.target
    const parentPath = getParentPath(entry.path) ?? controller.rootPath
    const items: ContextMenuItem[] = []
    if (entry.is_dir) {
      items.push({ id: 'toggle', label: controller.expandedPaths.has(entry.path) ? 'Collapse' : 'Expand', icon: controller.expandedPaths.has(entry.path) ? 'pi-chevron-up' : 'pi-chevron-down', onSelect: () => controller.toggleFolder(entry.path) })
      items.push({ id: 'new-file', label: 'New File', icon: 'pi-file', shortcut: shortcut('new_file'), onSelect: () => void createAndRename(entry.path, false) })
      items.push({ id: 'new-folder', label: 'New Folder', icon: 'pi-folder', onSelect: () => void createAndRename(entry.path, true) })
      items.push({ type: 'separator' })
      items.push({ id: 'refresh', label: 'Refresh', icon: 'pi-refresh', onSelect: () => controller.refreshDirectory(entry.path) })
    } else if (entry.is_markdown) {
      items.push({ id: 'open', label: 'Open', icon: 'pi-file-edit', onSelect: () => onSelectFile(entry.path) })
    } else {
      items.push({ id: 'open', label: 'Open with Default App', icon: 'pi-external-link', onSelect: () => controller.openItem(entry.path) })
    }
    items.push({ type: 'separator' })
    items.push({ id: 'rename', label: 'Rename', icon: 'pi-pencil', onSelect: () => { requestRename(entry.path) } })
    items.push({ id: 'duplicate', label: 'Duplicate', icon: 'pi-copy', onSelect: async () => { await controller.duplicateItem(entry.path) } })
    if (parentPath && entry.path !== controller.rootPath) items.push({ id: 'move', label: 'Move to…', icon: 'pi-arrow-right-arrow-left', onSelect: () => setMovePath(entry.path) })
    items.push({ type: 'separator' })
    items.push({ id: 'copy-path', label: 'Copy Path', icon: 'pi-copy', onSelect: () => copyPath(entry.path) })
    if (controller.rootPath) items.push({ id: 'copy-relative-path', label: 'Copy Relative Path', icon: 'pi-link', onSelect: () => copyRelativePath(entry.path) })
    items.push({ id: 'reveal', label: 'Reveal in Finder', icon: 'pi-search', onSelect: () => controller.revealItem(entry.path) })
    if (entry.is_dir || entry.is_markdown) items.push({ id: 'open-default', label: 'Open with Default App', icon: 'pi-external-link', onSelect: () => controller.openItem(entry.path) })
    items.push({ type: 'separator' })
    items.push({ id: 'delete', label: 'Delete', icon: 'pi-trash', danger: true, onSelect: () => deleteEntry(entry.path) })
    return items
  }
  return <div className={`relative z-4 w-0 overflow-visible pointer-events-none transition-[width] duration-[160ms] [transition-timing-function:cubic-bezier(0,0,0.58,1)] react-sidebar-host${isOpen ? ' is-open' : ''}${isHovering ? ' is-hovering' : ''}`} style={isOpen ? { width } : undefined}>
   <div className={`react-safety-triangle${isHovering && !isOpen ? ' is-active' : ''}`} />
   <aside className="react-sidebar absolute left-[5px] top-[92px] z-4 h-[calc(100%-97px)] min-w-0 overflow-hidden rounded-[25px] p-2.5 text-[rgba(163,163,168,1)] opacity-0 bg-transparent transition-[transform,backdrop-filter,opacity,background,top,height] duration-[160ms] [transition-timing-function:cubic-bezier(0.42,0,1,1)]" style={{ width: width - 10 }} aria-label="Navigation" onClick={() => menu && setMenu(null)}>
     <div className="grid h-full w-full grid-rows-[1fr_auto] overflow-hidden rounded-[25px]">
       <nav className="flex min-h-0 flex-col overflow-hidden px-2 text-sm" aria-label="Navigation">
         <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
           <span className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white/90${controller.rootName ? '' : ' italic font-normal text-white/40'}`} onContextMenu={contextMenuRoot}>{controller.rootName ?? 'No folder open'}</span>
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
     {menu && <ContextMenu x={menu.x} y={menu.y} label={menu.target === 'root' ? 'Workspace actions' : `Actions for ${menu.target.name}`} items={menuItems()} onClose={() => setMenu(null)} />}
     {movePath && controller.rootPath && <div className="fixed inset-0 z-[1999] flex items-center justify-center bg-black/20 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMovePath(null) }}>
       <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[rgba(30,30,30,0.98)] p-3 text-white shadow-[0_14px_40px_rgba(0,0,0,0.4)]" role="dialog" aria-modal="true" aria-label="Move item">
         <div className="mb-2 flex items-center justify-between"><h2 className="m-0 text-sm font-semibold">Move item to…</h2><button type="button" className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close move dialog" onClick={() => setMovePath(null)}><i className="pi pi-times" /></button></div>
         <div className="max-h-64 overflow-y-auto">
           <button type="button" className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-white/90 hover:bg-white/10" onClick={() => void move(movePath, controller.rootPath!)}><i className="pi pi-folder" />{controller.rootName ?? 'Workspace'}</button>
           {folders(controller.entries, movePath).map(folder => <button key={folder.path} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-white/90 hover:bg-white/10" style={{ paddingLeft: `${8 + folder.path.split(/[\\/]/).length * 8}px` }} onClick={() => void move(movePath, folder.path)}><i className="pi pi-folder" />{folder.name}</button>)}
         </div>
       </div>
     </div>}
  </aside>
  </div>
}
