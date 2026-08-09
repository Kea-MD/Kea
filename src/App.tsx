import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useReactTheme } from './theme'
import { useRuntimeContext } from './runtime/RuntimeContext'
import { SettingsDialog } from './settings/SettingsDialog'
import { useReactSettings } from './settings/useSettings'
import { Sidebar } from './workspace/Sidebar'
import { useWorkspaceController } from './workspace/useWorkspaceController'
import { useSidebarInteraction } from './workspace/useSidebarInteraction'
import { useSidebarResize } from './workspace/useSidebarResize'
import { MouseRingGlow } from './ui/MouseRingGlow'
import { DocumentTabs } from './editor/DocumentTabs'
import { useDocumentController } from './editor/useDocumentController'
import { EditorSurface } from './editor/EditorSurface'
import { useReactAutoSave } from './editor/useReactAutoSave'
import type { DocumentStoragePort } from './core/contracts/document'
import type { WorkspacePort } from './core/contracts/workspace'
import { resolveShortcutAction } from './modules/settings/shortcuts/shortcutRegistry'
import { scheduleAutoUpdateCheck } from './settings/updatesClient'

const toolbarGroups: Array<Array<{ icon: string; label: string }>> = [
  [
    { icon: 'undo', label: 'Undo' },
    { icon: 'redo', label: 'Redo' },
    { icon: 'search', label: 'Find' },
  ],
  [
    { icon: 'format_bold', label: 'Bold' },
    { icon: 'format_italic', label: 'Italic' },
    { icon: 'format_strikethrough', label: 'Strikethrough' },
    { icon: 'code', label: 'Inline Code' },
    { icon: 'data_object', label: 'Code Block' },
    { icon: 'format_quote', label: 'Blockquote' },
    { icon: 'horizontal_rule', label: 'Horizontal Rule' },
  ],
  [
    { icon: 'link', label: 'Insert Link' },
    { icon: 'image', label: 'Insert Image' },
    { icon: 'format_color_fill', label: 'Highlight' },
  ],
]

function Icon({ children }: { children: string }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{children}</span>
}

function IconButton({
  icon,
  label,
  disabled = false,
  active = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  icon: string
  label: string
  disabled?: boolean
  active?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-[5px] border-0 bg-transparent p-0 text-[var(--react-dark-500)] transition-colors hover:bg-[var(--react-hover-background)] hover:text-[var(--react-dark-700)] disabled:cursor-not-allowed disabled:opacity-50${active ? ' bg-[var(--react-hover-background)] text-[var(--react-dark-700)]' : ''}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Icon>{icon}</Icon>
    </button>
  )
}

function Toolbar({
  sidebarOpen,
  onToggleSidebar,
  onSidebarHover,
  isDark,
  onToggleTheme,
  editorMode,
  onToggleEditorMode,
}: {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onSidebarHover: (hovering: boolean) => void
  isDark: boolean
  onToggleTheme: () => void
  editorMode: 'source' | 'rendered'
  onToggleEditorMode: () => void
}) {
  return (
    <div className="grid min-h-[42px] flex-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 overflow-hidden bg-[var(--react-toolbar-background)] px-4 py-2 [box-shadow:0_-1px_0_var(--react-border),0_1px_0_var(--react-border)]" aria-label="Editor toolbar">
      <div className="flex min-w-0 items-center gap-1">
        <IconButton
          icon="dock_to_right"
          label={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
          active={sidebarOpen}
          onClick={onToggleSidebar}
          onMouseEnter={() => onSidebarHover(true)}
          onMouseLeave={() => onSidebarHover(false)}
        />
      </div>
      <div className="flex min-w-0 items-center justify-center gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap">
        {toolbarGroups.map((group, groupIndex) => (
          <div className="flex flex-none items-center gap-1" key={groupIndex}>
            {groupIndex > 0 && <span className="mx-[5px] h-[21px] w-px bg-[var(--react-dark-300)]" aria-hidden="true" />}
            {group.map((button) => (
              <IconButton key={button.label} icon={button.icon} label={button.label} disabled />
            ))}
          </div>
        ))}
        <span className="mx-[5px] h-[21px] w-px bg-[var(--react-dark-300)]" aria-hidden="true" />
        <label>
          <span className="sr-only">Heading level</span>
          <select className="h-[25px] w-[60px] rounded-lg border border-[var(--react-dark-300)] bg-[var(--react-light-200)] px-1 text-[12px] text-[var(--react-light-500)] outline-none dark:border-[var(--react-dark-300)] dark:bg-[var(--react-dark-200)] dark:text-[var(--react-dark-500)]" defaultValue="P" aria-label="Heading level" disabled>
            <option>P</option>
            <option>H1</option>
            <option>H2</option>
            <option>H3</option>
          </select>
        </label>
        <label>
          <span className="sr-only">List style</span>
          <select className="h-[25px] w-[42px] rounded-lg border border-[var(--react-dark-300)] bg-[var(--react-light-200)] px-1 text-[12px] text-[var(--react-light-500)] outline-none dark:border-[var(--react-dark-300)] dark:bg-[var(--react-dark-200)] dark:text-[var(--react-dark-500)]" defaultValue="•" aria-label="List style" disabled>
            <option>•</option>
            <option>1.</option>
            <option>☑</option>
          </select>
        </label>
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1">
        <button
          type="button"
           className={`inline-flex h-[26px] items-center gap-[.35rem] rounded-none border-0 bg-transparent p-0 text-xs text-[var(--react-light-600)] dark:gap-0 dark:rounded-lg dark:px-2 dark:text-[11px]${editorMode === 'source' ? ' text-[var(--react-light-700)] dark:bg-[var(--react-hover-background)] dark:text-[var(--react-dark-700)]' : ''}`}
          role="switch"
          aria-checked={editorMode === 'source'}
          aria-label="Toggle editor mode"
          onClick={onToggleEditorMode}
        >
          <span>Source</span>
          <span className={`relative inline-block h-4 w-[25px] flex-none origin-center scale-[.76] rounded-full border border-[var(--react-light-400)] bg-[var(--react-light-50)] dark:border-[var(--react-dark-300)] dark:bg-[var(--react-dark-200)]${editorMode === 'source' ? ' border-[rgb(var(--react-brand-rgb))] bg-[rgb(var(--react-brand-rgb))]' : ''}`} aria-hidden="true"><span className={`absolute left-px top-px h-3 w-3 rounded-full bg-[var(--react-light-400)] transition-[left,background-color] dark:bg-[var(--react-dark-100)]${editorMode === 'source' ? ' left-[10px] bg-[var(--react-light-200)] dark:bg-[var(--react-dark-200)]' : ''}`} /></span>
        </button>
        <IconButton icon={isDark ? 'light_mode' : 'dark_mode'} label={isDark ? 'Use light theme' : 'Use dark theme'} onClick={onToggleTheme} />
      </div>
    </div>
  )
}

function EmptyEditor({ children, onOpenFolder, onOpenFile, onNewFile, selectedFilePath, loading, error }: { children?: ReactNode; onOpenFolder?: () => void; onOpenFile?: () => void; onNewFile?: () => void; selectedFilePath: string | null; loading?: boolean; error?: string | null }) {
  return (
    <section className="absolute inset-0 flex items-center justify-center" aria-label="Editor preview">
      <div className="max-w-[560px] px-5 text-center text-[var(--react-dark-500)]">
        <span className="material-symbols-outlined mb-4 !text-[64px] opacity-50">description</span>
        <h1 className="mb-[10px] text-2xl font-medium text-[var(--react-dark-700)]">{loading ? 'Loading document' : selectedFilePath ? 'Editor surface coming next' : 'No file open'}</h1>
        <p className="m-0 opacity-[.85]">{loading ? `Opening ${selectedFilePath}` : selectedFilePath ? `${selectedFilePath} is open in a React tab. The CodeMirror surface is the next migration slice.` : 'Open a markdown file to start editing'}</p>
        {error && <p className="m-0" role="alert">{error}</p>}
        <div className="mt-[26px] flex flex-wrap justify-center gap-2.5">
           <button type="button" className="inline-flex min-w-[136px] cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[var(--react-dark-200)] px-4 py-2.5 text-[13px] font-medium text-[var(--react-dark-700)]" onClick={onOpenFolder}><Icon>folder</Icon>Open Folder</button>
           <button type="button" className="inline-flex min-w-[136px] cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[var(--react-dark-200)] px-4 py-2.5 text-[13px] font-medium text-[var(--react-dark-700)]" onClick={onOpenFile}><Icon>description</Icon>Open File</button>
           <button type="button" className="inline-flex min-w-[136px] cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[rgb(var(--react-brand-rgb))] px-4 py-2.5 text-[13px] font-medium text-white" onClick={onNewFile}><Icon>add</Icon>New File</button>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5 text-[11px] text-[var(--react-dark-500)]" aria-label="Keyboard shortcuts">
          <span className="inline-flex min-w-[100px] items-center justify-center gap-1.5"><kbd className="rounded border border-[var(--react-dark-300)] bg-[var(--react-dark-100)] px-1.5 py-0.5">⌘O</kbd> Folder</span>
          <span className="inline-flex min-w-[100px] items-center justify-center gap-1.5"><kbd className="rounded border border-[var(--react-dark-300)] bg-[var(--react-dark-100)] px-1.5 py-0.5">⌘P</kbd> File</span>
          <span className="inline-flex min-w-[100px] items-center justify-center gap-1.5"><kbd className="rounded border border-[var(--react-dark-300)] bg-[var(--react-dark-100)] px-1.5 py-0.5">⌘N</kbd> New</span>
        </div>
        {children}
      </div>
    </section>
  )
}

export interface ReactShellProps {
  workspacePort?: WorkspacePort
  documentStoragePort?: DocumentStoragePort
  onOpenFile?: (path: string) => void
}

export default function App({ workspacePort, documentStoragePort, onOpenFile }: ReactShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shellElement, setShellElement] = useState<HTMLDivElement | null>(null)
  const [editorMode, setEditorMode] = useState<'source' | 'rendered'>('rendered')
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null)
  const settingsController = useReactSettings()
  const { settings } = settingsController
  const workspace = useWorkspaceController(workspacePort, { restoreWorkspaceOnLaunch: settings.restoreWorkspaceOnLaunch })
  const documents = useDocumentController(documentStoragePort)
  useReactAutoSave(documents.activeDocument, documents.saveFile)
  const { sidebarOpen, sidebarHovering, toggleSidebar, handleSidebarHover } = useSidebarInteraction()
  const { sidebarWidth, isResizing, startResize } = useSidebarResize()
  const { isDark, toggleTheme, themeMode, setThemeMode } = useReactTheme()
  const { hasTrafficLightsInset, isTauri } = useRuntimeContext()

  useEffect(() => scheduleAutoUpdateCheck(), [isTauri])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (resolveShortcutAction(event, settings.shortcuts) !== 'open_settings') return
      event.preventDefault()
      setSettingsOpen(true)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [settings.shortcuts])

  useEffect(() => {
    if (!isTauri) return

    let disposed = false
    let unlisten: (() => void) | undefined
    void listen<string>('menu-event', event => {
      if (event.payload === 'open_settings') setSettingsOpen(true)
    }).then(removeListener => {
      if (disposed) removeListener()
      else unlisten = removeListener
    }).catch(error => console.error('Failed to listen for native menu events:', error))

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [isTauri])
  const selectedPath = documents.activeDocument?.path || ((documents.isLoading || documents.error) ? pendingFilePath : null)

  const selectFile = (path: string) => {
    setPendingFilePath(path)
    void documents.openFileFromPath(path).then(id => {
      if (id) {
        setPendingFilePath(null)
        onOpenFile?.(path)
      }
    })
  }

  const handlePathChanged = (oldPath: string, newPath: string | null, isDirectory = false) => {
    if (!newPath) {
      const affected = documents.documents.filter(document => document.path === oldPath || (isDirectory && (document.path.startsWith(`${oldPath}/`) || document.path.startsWith(`${oldPath}\\`))))
      for (const document of affected) void documents.closeDocument(document.id, true)
      return
    }
    documents.updatePathsAfterRename(oldPath, newPath, isDirectory)
  }

  return (
    <div ref={setShellElement} className="react-spike-shell relative h-screen w-screen overflow-hidden rounded-[var(--react-radius)] bg-[var(--react-shell-background)] p-[var(--react-inset)] text-[var(--react-dark-700)] [clip-path:inset(0_round_var(--react-radius))] [isolation:isolate]">
      {settings.edgeGlowEnabled && <MouseRingGlow hostElement={shellElement} />}
      <div className="absolute inset-x-0 top-0 z-10 h-5 [app-region:drag]" data-tauri-drag-region="true" />
      <div className="react-page-container relative z-[1] flex h-full w-full rounded-[calc(var(--react-radius)-var(--react-inset))] bg-[var(--react-page-background)] p-[var(--react-inset)]">
        <div className={`grid h-full w-full min-w-0 [grid-template-columns:var(--react-sidebar-grid)] transition-[grid-template-columns] duration-[160ms] [transition-timing-function:cubic-bezier(0,0,0.58,1)] max-md:relative max-md:grid-cols-1 ${isResizing ? 'transition-none' : ''}`} style={{ '--react-sidebar-grid': sidebarOpen ? `${sidebarWidth}px minmax(0,1fr)` : '0 minmax(0,1fr)' } as CSSProperties}>
            <Sidebar width={sidebarWidth} isOpen={sidebarOpen} isHovering={sidebarHovering} controller={workspace} activePath={selectedPath} onSelectFile={selectFile} onPathChanged={handlePathChanged} onNewFile={() => { setPendingFilePath(null); documents.newFile() }} onOpenFile={() => { setPendingFilePath(null); void documents.openFileDialog() }} onSaveFile={() => void documents.saveFile()} canSave={Boolean(documents.activeDocument) || documents.documents.some(document => document.isDirty)} isSaving={documents.isSaving} openDocuments={documents.documents} onCloseDocuments={async ids => { for (const id of ids) await documents.closeDocument(id, true) }} onSettings={() => setSettingsOpen(true)} />
            {sidebarOpen && <div className={`absolute top-10 bottom-[5px] z-10 w-2 cursor-col-resize rounded transition-[background] duration-150 ease-in after:absolute after:left-1/2 after:top-1/2 after:h-10 after:w-[3px] after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-sm after:bg-transparent after:transition-[background] hover:after:bg-[rgba(40,44,51,0.42)]${isResizing ? ' after:bg-[rgba(40,44,51,0.42)]' : ''}`} style={{ left: sidebarWidth + 5 }} onMouseDown={startResize} />}
             <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[30px] bg-[var(--react-panel-background)]">
             <DocumentTabs documents={documents.documents} activeDocumentId={documents.activeDocumentId} hasTrafficLightsInset={hasTrafficLightsInset} sidebarOpen={sidebarOpen} onSelect={documents.setActiveDocument} onClose={id => { void documents.closeDocument(id) }} onReorder={documents.reorderDocuments} onNew={() => { setPendingFilePath(null); documents.newFile() }} />
            <Toolbar
              sidebarOpen={sidebarOpen}
               onToggleSidebar={toggleSidebar}
               onSidebarHover={handleSidebarHover}
              isDark={isDark}
              onToggleTheme={toggleTheme}
              editorMode={editorMode}
              onToggleEditorMode={() => setEditorMode((mode) => mode === 'source' ? 'rendered' : 'source')}
            />
              <div className="react-editor-content relative flex min-h-0 flex-1 bg-transparent">{documents.activeDocument
                ? <EditorSurface document={documents.activeDocument} mode={editorMode} onChange={documents.updateContent} onOpenFile={() => { setPendingFilePath(null); void documents.openFileDialog() }} />
                : <EmptyEditor selectedFilePath={selectedPath} loading={documents.isLoading} error={documents.error} onOpenFolder={() => void workspace.openFolder()} onOpenFile={() => { setPendingFilePath(null); void documents.openFileDialog() }} onNewFile={() => { setPendingFilePath(null); documents.newFile() }} />}</div>
          </main>
        </div>
      </div>
      {settingsOpen && <SettingsDialog
        settings={settings}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        onRestoreWorkspaceChange={settingsController.setRestoreWorkspaceOnLaunch}
        onEdgeGlowChange={settingsController.setEdgeGlowEnabled}
        onSetShortcut={settingsController.setShortcut}
        onResetShortcut={settingsController.resetShortcut}
        onResetAllShortcuts={settingsController.resetAllShortcuts}
        onClose={() => setSettingsOpen(false)}
      />}
    </div>
  )
}
