import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useReactTheme } from './theme'
import { useRuntimeContext } from './runtime/RuntimeContext'
import { SettingsDialog } from './settings/SettingsDialog'
import { useReactSettings } from './settings/useSettings'
import { Sidebar } from './workspace/Sidebar'
import { useWorkspaceController } from './workspace/useWorkspaceController'
import { useSidebarInteraction } from './workspace/useSidebarInteraction'
import { useHoverReveal } from './workspace/useHoverReveal'
import { useSidebarResize } from './workspace/useSidebarResize'
import { MouseRingGlow } from './ui/MouseRingGlow'
import { DocumentTabs } from './editor/DocumentTabs'
import { useDocumentController } from './editor/useDocumentController'
import { EditorSurface } from './editor/EditorSurface'
import { CodeMirrorToolbar } from './editor/CodeMirrorToolbar'
import { useReactAutoSave } from './editor/useReactAutoSave'
import { useExternalFileSync } from './editor/useExternalFileSync'
import type { DocumentStoragePort } from './core/contracts/document'
import type { EditorController } from './core/contracts/editor'
import type { WorkspacePort } from './core/contracts/workspace'
import { resolveShortcutAction } from './modules/settings/shortcuts/shortcutRegistry'
import { resolveMarkdownLink } from './editor/linkNavigation'
import { extractMarkdownHeadings } from './editor/markdownHeadings'
import { QuickOpenDialog } from './workspace/QuickOpenDialog'
import { DocumentOutline } from './editor/DocumentOutline'
import { scheduleAutoUpdateCheck } from './settings/updatesClient'
import { ContextMenu } from './shared/ContextMenu'
import { openDeveloperTools, openNewWindow, reloadApplication } from './adapters/runtime/runtimeActions'
import { clearDocumentSession, readDocumentSession, writeDocumentSession } from './editor/documentSession'
import { getWindowLabel } from './runtime/windowIdentity'

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
  showSidebarToggle,
  onToggleSidebar,
  onSidebarHover,
  isDark,
  onToggleTheme,
  editor,
}: {
  showSidebarToggle: boolean
  onToggleSidebar: () => void
  onSidebarHover: (hovering: boolean) => void
  isDark: boolean
  onToggleTheme: () => void
  editor: EditorController | null
}) {
  return (
    <div className="relative z-[1] flex min-h-[42px] flex-none items-center overflow-visible bg-[var(--react-toolbar-background)] px-3 py-2 [outline:1px_solid_var(--react-border)]" aria-label="Editor toolbar">
      {showSidebarToggle && <div className="absolute inset-y-0 left-3 z-10 flex items-center gap-1 bg-[var(--react-toolbar-background)]">
        <IconButton
          icon="dock_to_right"
          label="Show Sidebar"
          onClick={onToggleSidebar}
          onMouseEnter={() => onSidebarHover(true)}
          onMouseLeave={() => onSidebarHover(false)}
        />
      </div>}
      <div className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
        <CodeMirrorToolbar editor={editor} />
      </div>
      <div className="absolute inset-y-0 right-3 z-10 flex items-center gap-1 bg-[var(--react-toolbar-background)]">
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
        <p className="m-0 opacity-[.85]">{loading ? `Opening ${selectedFilePath}` : selectedFilePath ? `${selectedFilePath} is open in a React tab.` : 'Open a markdown file to start editing'}</p>
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
  const windowLabel = getWindowLabel()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shellElement, setShellElement] = useState<HTMLDivElement | null>(null)
  const [activeEditor, setActiveEditor] = useState<EditorController | null>(null)
  const [activeHeadingPosition, setActiveHeadingPosition] = useState<number | null>(null)
  const [, setEditorStateVersion] = useState(0)
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const [topChromeHeight, setTopChromeHeight] = useState(82)
  const [pendingAnchor, setPendingAnchor] = useState<{ documentId: string; anchor: string } | null>(null)
  const [shellMenu, setShellMenu] = useState<{ x: number; y: number } | null>(null)
  const settingsController = useReactSettings()
  const { settings } = settingsController
  const workspace = useWorkspaceController(workspacePort, { restoreWorkspaceOnLaunch: settings.restoreWorkspaceOnLaunch, windowLabel })
  const documents = useDocumentController(documentStoragePort)
  const documentsRef = useRef(documents)
  const activeEditorRef = useRef(activeEditor)
  documentsRef.current = documents
  activeEditorRef.current = activeEditor
  useReactAutoSave(documents.activeDocument, documents.saveFile)
  const { sidebarOpen, sidebarHovering, toggleSidebar, closeSidebar, handleSidebarHover } = useSidebarInteraction()
  const { hovering: topChromeHovering, handleHover: handleTopChromeHover } = useHoverReveal()
  const { sidebarWidth, isResizing, startResize } = useSidebarResize()
  const { isDark, toggleTheme, themeMode, setThemeMode } = useReactTheme()
  const { hasTrafficLightsInset, isTauri, isMac, isMobile } = useRuntimeContext()
  useExternalFileSync(documents.documents, isTauri, documents.checkExternalChange)

  const topChromeRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const element = topChromeRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const updateHeight = () => {
      const nextHeight = Math.round(element.getBoundingClientRect().height)
      setTopChromeHeight(current => current === nextHeight ? current : nextHeight)
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isMobile) closeSidebar()
  }, [closeSidebar, isMobile])

  const documentSessionRootRef = useRef<string | null>(null)
  const [documentSessionReadyRoot, setDocumentSessionReadyRoot] = useState<string | null>(null)
  const restoreDocumentsRef = useRef(documents.restoreDocuments)
  restoreDocumentsRef.current = documents.restoreDocuments

  useEffect(() => {
    const rootPath = workspace.rootPath
    if (!rootPath) {
      documentSessionRootRef.current = null
      setDocumentSessionReadyRoot(null)
      return
    }
    if (documentSessionRootRef.current === rootPath) return

    documentSessionRootRef.current = rootPath
    setDocumentSessionReadyRoot(null)
    const session = readDocumentSession(windowLabel, rootPath)
    if (!session) {
      setDocumentSessionReadyRoot(rootPath)
      return
    }

    let cancelled = false
    void restoreDocumentsRef.current(session.paths, session.activePath).then(() => {
      if (!cancelled && documentSessionRootRef.current === rootPath) setDocumentSessionReadyRoot(rootPath)
    })
    return () => { cancelled = true }
  }, [windowLabel, workspace.rootPath])

  useEffect(() => {
    const rootPath = workspace.rootPath
    if (!rootPath || documentSessionReadyRoot !== rootPath) return
    writeDocumentSession(windowLabel, rootPath, {
      paths: documents.documents.map(document => document.path).filter(Boolean),
      activePath: documents.activeDocument?.path || null,
    })
  }, [documents.activeDocument?.path, documents.documents, documentSessionReadyRoot, windowLabel, workspace.rootPath])

  useEffect(() => scheduleAutoUpdateCheck(), [isTauri])

  const handleEditorChange = useCallback((editor: EditorController | null) => {
    setActiveEditor(editor)
  }, [])
  const handleActiveHeadingChange = useCallback((position: number | null) => {
    setActiveHeadingPosition(position)
  }, [])
  const refreshEditorState = useCallback(() => {
    setEditorStateVersion(version => version + 1)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = resolveShortcutAction(event, settings.shortcuts)
      if (!action || action === 'toggle_editor_mode') return
      event.preventDefault()
      switch (action) {
        case 'new_file': documents.newFile(); break
        case 'open_file': void documents.openFileDialog(); break
        case 'open_folder': void workspace.openFolder(); break
        case 'save': void documents.saveFile(activeEditor?.getContent()); break
        case 'save_as': void documents.saveFileAs(activeEditor?.getContent()); break
        case 'close_tab': if (documents.activeDocumentId) void documents.closeDocument(documents.activeDocumentId); break
        case 'toggle_sidebar': toggleSidebar(); break
        case 'undo': activeEditor?.execute('undo'); break
        case 'redo': activeEditor?.execute('redo'); break
        case 'find': activeEditor?.execute('find'); break
        case 'open_settings': setSettingsOpen(true); break
        case 'quick_open': setQuickOpen(true); break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeEditor, documents, settings.shortcuts, toggleSidebar, workspace])

  useEffect(() => {
    if (!isTauri) return

    let disposed = false
    let unlisten: (() => void) | undefined
    void listen<string>('menu-event', event => {
      if (event.payload === 'new_window') void openNewWindow()
      if (event.payload === 'open_settings') setSettingsOpen(true)
      if (event.payload === 'quick_open') setQuickOpen(true)
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

  useEffect(() => {
    if (!pendingAnchor || !activeEditor || pendingAnchor.documentId !== documents.activeDocumentId) return
    const heading = extractMarkdownHeadings(activeEditor.getContent()).find(item => item.anchor === pendingAnchor.anchor)
    if (heading) activeEditor.revealPosition(heading.position)
    setPendingAnchor(null)
  }, [activeEditor, documents.activeDocumentId, pendingAnchor])

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

  const closeWorkspace = async (): Promise<void> => {
    for (const document of documents.documents) {
      if (!(await documents.closeDocument(document.id))) return
    }
    if (workspace.rootPath) clearDocumentSession(windowLabel, workspace.rootPath)
    workspace.closeWorkspace()
  }
  const closeOtherDocuments = async (keepId: string): Promise<void> => {
    for (const document of documents.documents.filter(item => item.id !== keepId)) {
      if (!(await documents.closeDocument(document.id))) return
    }
  }
  const closeDocumentsToRight = async (id: string): Promise<void> => {
    const index = documents.documents.findIndex(document => document.id === id)
    if (index < 0) return
    for (const document of documents.documents.slice(index + 1)) {
      if (!(await documents.closeDocument(document.id))) return
    }
  }
  const closeAllDocuments = async (): Promise<void> => {
    for (const document of documents.documents) {
      if (!(await documents.closeDocument(document.id))) return
    }
  }
  const copyPath = async (path: string): Promise<void> => {
    try {
      await navigator.clipboard?.writeText(path)
    } catch (error) {
      console.error('Failed to copy path:', error)
    }
  }
  const handleShellContextMenu = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented) return
    event.preventDefault()
    setShellMenu({ x: event.clientX, y: event.clientY })
  }

  const handleOpenLink = useCallback((url: string): void => {
    const documentController = documentsRef.current
    const editor = activeEditorRef.current
    const current = documentController.activeDocument
    if (!current) return
    const target = resolveMarkdownLink(current.path, url)
    if (!target) return
    if (target.kind === 'external') {
      window.open(target.url, '_blank', 'noopener,noreferrer')
      return
    }
    if (!target.path) return
    if (target.path === current.path) {
      const heading = extractMarkdownHeadings(editor?.getContent() ?? current.content).find(item => item.anchor === target.anchor)
      if (heading) editor?.revealPosition(heading.position)
      return
    }
    void documentController.openFileFromPath(target.path).then(documentId => {
      if (documentId && target.anchor) setPendingAnchor({ documentId, anchor: target.anchor })
    })
  }, [])

  const toolbarSidebarButtonVisible = !sidebarOpen && (!settings.revealTopChromeOnEdgeHover || topChromeHovering)
  const topChromeHidden = settings.revealTopChromeOnEdgeHover && !topChromeHovering

  return (
    <div ref={setShellElement} onContextMenu={handleShellContextMenu} className="react-spike-shell relative h-screen w-screen overflow-hidden rounded-[var(--react-radius)] bg-[var(--react-shell-background)] p-[var(--react-inset)] text-[var(--react-dark-700)] [isolation:isolate]">
      {settings.edgeGlowEnabled && <MouseRingGlow hostElement={shellElement} />}
      <div className="absolute inset-x-0 top-0 z-10 h-5 [app-region:drag]" data-tauri-drag-region="true" />
      {settings.revealTopChromeOnEdgeHover && !isMobile && <div className="react-top-chrome-edge-trigger" data-testid="top-chrome-edge-hover-trigger" aria-hidden="true" onMouseEnter={() => handleTopChromeHover(true)} onMouseLeave={() => handleTopChromeHover(false)} />}
      <div className="react-page-container relative z-[1] flex h-full w-full rounded-[calc(var(--react-radius)-var(--react-inset))] bg-[var(--react-page-background)] p-[var(--react-inset)]">
        {settings.revealSidebarOnEdgeHover && !isMobile && <div className="react-sidebar-edge-trigger" data-testid="sidebar-edge-hover-trigger" aria-hidden="true" onMouseEnter={() => handleSidebarHover(true)} onMouseLeave={() => handleSidebarHover(false)} />}
        <div className={`grid h-full w-full min-w-0 [grid-template-columns:var(--react-sidebar-grid)] transition-[grid-template-columns] duration-[160ms] [transition-timing-function:cubic-bezier(0,0,0.58,1)] ${isResizing ? 'transition-none' : ''}`} style={{ '--react-sidebar-grid': sidebarOpen ? `${sidebarWidth}px minmax(0,1fr)` : '0 minmax(0,1fr)' } as CSSProperties}>
            <Sidebar width={sidebarWidth} isOpen={sidebarOpen} isHovering={sidebarHovering} showSidebarToggle={!toolbarSidebarButtonVisible} onToggleSidebar={toggleSidebar} topChromeHidden={topChromeHidden} controller={workspace} activePath={selectedPath} onSelectFile={selectFile} onPathChanged={handlePathChanged} onNewFile={() => { setPendingFilePath(null); documents.newFile() }} onOpenFile={() => { setPendingFilePath(null); void documents.openFileDialog() }} onSaveFile={() => void documents.saveFile(activeEditor?.getContent())} canSave={Boolean(documents.activeDocument) || documents.documents.some(document => document.isDirty)} isSaving={documents.isSaving} openDocuments={documents.documents} onCloseDocuments={async ids => { for (const id of ids) await documents.closeDocument(id, true) }} onCloseWorkspace={closeWorkspace} shortcuts={settings.shortcuts} onSettings={() => setSettingsOpen(true)} />
            {sidebarOpen && <div className={`absolute top-10 bottom-[5px] z-10 w-2 cursor-col-resize rounded transition-[background] duration-150 ease-in after:absolute after:left-1/2 after:top-1/2 after:h-10 after:w-[3px] after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-sm after:bg-transparent after:transition-[background] hover:after:bg-[rgba(40,44,51,0.42)]${isResizing ? ' after:bg-[rgba(40,44,51,0.42)]' : ''}`} style={{ left: sidebarWidth + 5 }} onMouseDown={startResize} />}
             <main className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--react-panel-radius)] border border-[var(--react-border)] bg-[var(--react-panel-background)]${settings.revealTopChromeOnEdgeHover ? ` is-top-chrome-reveal-enabled${topChromeHovering ? ' is-top-chrome-visible' : ''}` : ''}`} style={{ '--react-top-chrome-height': `${topChromeHeight}px` } as CSSProperties}>
            <div ref={topChromeRef} className={`react-top-chrome${settings.revealTopChromeOnEdgeHover ? ` is-hover-enabled${topChromeHovering ? ' is-hovering' : ''}` : ''}`} data-testid="react-top-chrome" onMouseEnter={() => handleTopChromeHover(true)} onMouseLeave={() => handleTopChromeHover(false)}>
              <DocumentTabs
                 documents={documents.documents}
                 activeDocumentId={documents.activeDocumentId}
                 hasTrafficLightsInset={hasTrafficLightsInset}
                 sidebarOpen={sidebarOpen}
                 onSelect={documents.setActiveDocument}
                 onClose={id => { void documents.closeDocument(id) }}
                 onReorder={documents.reorderDocuments}
                 onNew={() => { setPendingFilePath(null); documents.newFile() }}
                 onSave={id => documents.saveDocument(id, id === documents.activeDocumentId ? activeEditor?.getContent() : undefined)}
                 onSaveAs={id => documents.saveDocumentAs(id, id === documents.activeDocumentId ? activeEditor?.getContent() : undefined)}
                 onCopyPath={copyPath}
                 onReveal={path => workspace.revealItem(path)}
                 onCloseOthers={closeOtherDocuments}
                 onCloseToRight={closeDocumentsToRight}
                 onCloseAll={closeAllDocuments}
                 shortcuts={settings.shortcuts}
               />
            <Toolbar
                showSidebarToggle={toolbarSidebarButtonVisible}
                onToggleSidebar={toggleSidebar}
                onSidebarHover={handleSidebarHover}
                isDark={isDark}
                onToggleTheme={toggleTheme}
                editor={activeEditor}
              />
            </div>
              <div className={`react-editor-content relative flex min-h-0 flex-1 bg-transparent${settings.revealTopChromeOnEdgeHover ? ' is-top-chrome-aware' : ''}`}>
                {documents.activeDocument
                  ? <EditorSurface document={documents.activeDocument} onChange={documents.updateContent} onEditorChange={handleEditorChange} onEditorStateChange={refreshEditorState} onActiveHeadingChange={handleActiveHeadingChange} onOpenLink={handleOpenLink} topChromeHidden={topChromeHidden} />
                  : <EmptyEditor selectedFilePath={selectedPath} loading={documents.isLoading} error={documents.error} onOpenFolder={() => void workspace.openFolder()} onOpenFile={() => { setPendingFilePath(null); void documents.openFileDialog() }} onNewFile={() => { setPendingFilePath(null); documents.newFile() }} />}
                {documents.activeDocument && <DocumentOutline content={activeEditor?.getContent() ?? documents.activeDocument.content} activePosition={activeHeadingPosition} onReveal={position => activeEditor?.revealPosition(position)} />}
              </div>
          </main>
        </div>
      </div>
      {settingsOpen && <SettingsDialog
        settings={settings}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        onRestoreWorkspaceChange={settingsController.setRestoreWorkspaceOnLaunch}
        onRevealSidebarOnEdgeHoverChange={settingsController.setRevealSidebarOnEdgeHover}
        onRevealTopChromeOnEdgeHoverChange={settingsController.setRevealTopChromeOnEdgeHover}
        onEdgeGlowChange={settingsController.setEdgeGlowEnabled}
        onSetShortcut={settingsController.setShortcut}
        onResetShortcut={settingsController.resetShortcut}
        onResetAllShortcuts={settingsController.resetAllShortcuts}
        onClose={() => setSettingsOpen(false)}
      />}
      {quickOpen && <QuickOpenDialog entries={workspace.entries} rootPath={workspace.rootPath} onOpen={selectFile} onClose={() => setQuickOpen(false)} />}
      {shellMenu && <ContextMenu
        x={shellMenu.x}
        y={shellMenu.y}
        label="App actions"
        onClose={() => setShellMenu(null)}
        items={[
          { id: 'reload', label: 'Reload', icon: 'pi-refresh', shortcut: isMac ? '⌘R' : 'Ctrl+R', onSelect: reloadApplication },
          ...(isTauri ? [{ id: 'devtools', label: 'Developer Tools', icon: 'pi-code', shortcut: isMac ? '⌥⌘I' : 'Ctrl+Shift+I', onSelect: openDeveloperTools }] : []),
        ]}
      />}
    </div>
  )
}
