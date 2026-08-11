import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { RuntimeProvider } from '../../src/runtime/RuntimeContext'
import type { RuntimePort } from '../../src/core/contracts'
import type { DocumentStoragePort } from '../../src/core/contracts/document'
import type { WorkspacePort } from '../../src/core/contracts/workspace'
import { DOCUMENT_SESSIONS_STORAGE_KEY } from '../../src/editor/documentSession'

const testRuntimePort: RuntimePort = {
  getInitialContext: () => ({ isTauri: false, isMac: false, isMobile: false }),
  readFullscreen: () => Promise.resolve(false),
  subscribeMobile: () => () => {},
  subscribeWindowState: () => Promise.resolve(() => {}),
}

const narrowRuntimePort: RuntimePort = {
  ...testRuntimePort,
  getInitialContext: () => ({ isTauri: false, isMac: false, isMobile: true }),
}

let systemDark = false
let systemChangeHandler: (() => void) | undefined

const matchMedia = vi.fn(() => ({
  get matches() {
    return systemDark
  },
  media: '(prefers-color-scheme: dark)',
  addEventListener: vi.fn((_event: string, handler: () => void) => {
    systemChangeHandler = handler
  }),
  removeEventListener: vi.fn(),
}))

const markdownWorkspacePort: WorkspacePort = {
  openFolderDialog: () => Promise.resolve({ path: '/workspace', name: 'workspace', entries: [{ name: 'note.md', path: '/workspace/note.md', is_dir: false, is_markdown: true }] }),
  readDirectory: () => Promise.resolve([]),
  createFile: () => Promise.resolve({ path: '/workspace/new.md', name: 'new.md', content: '' }),
  createFolder: () => Promise.resolve({ name: 'folder', path: '/workspace/folder', is_dir: true, is_markdown: false }),
  renameItem: () => Promise.resolve('/workspace/renamed.md'),
  deleteItem: () => Promise.resolve(),
  moveItem: () => Promise.resolve('/workspace/moved.md'),
  duplicateItem: () => Promise.resolve('/workspace/note copy.md'),
  openItem: () => Promise.resolve(),
  revealItem: () => Promise.resolve(),
}

const markdownDocumentStoragePort: DocumentStoragePort = {
  readFile: path => path === '/workspace/missing.md'
    ? Promise.reject('missing')
    : Promise.resolve({ path, name: path.split('/').pop() ?? 'note.md', content: '# Note\n', }),
  openMarkdownFile: () => Promise.resolve({ path: '/workspace/other.md', name: 'other.md', content: 'Other\n' }),
  saveMarkdownFile: () => Promise.resolve(),
  saveMarkdownFileAs: () => Promise.resolve({ path: '/workspace/saved.md', name: 'saved.md' }),
}

describe('React shell spike', () => {
  beforeEach(() => {
    window.localStorage.clear()
    systemDark = false
    systemChangeHandler = undefined
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia })
    document.documentElement.classList.remove('dark')
  })
  afterEach(() => vi.useRealTimers())

  it('renders the shell controls and empty editor state', async () => {
    vi.useFakeTimers()
    window.localStorage.setItem('kea-sidebar-open', 'true')
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    expect(screen.getByRole('main')).not.toBeNull()
    expect(document.querySelector('.react-spike-shell')?.classList.contains('select-none')).toBe(true)
    expect(screen.getByRole('heading', { name: 'No file open' })).not.toBeNull()
    expect(screen.getByTestId('react-top-chrome').querySelector('[aria-label="Show Sidebar"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Hide Sidebar' }).closest('.react-sidebar')).not.toBeNull()
    const sidebarHost = document.querySelector('.react-sidebar-host')
    const sidebar = screen.getByRole('complementary', { name: 'Navigation' })
    expect(sidebar.querySelector('[aria-label="New File"]')?.parentElement?.parentElement?.classList.contains('-mr-2')).toBe(true)
    expect(sidebarHost?.classList.contains('pointer-events-auto')).toBe(true)
    expect(sidebarHost?.classList.contains('pointer-events-none')).toBe(false)
    expect(screen.getByRole('button', { name: 'New document' })).not.toBeNull()
    const tabList = () => screen.getByRole('tablist').querySelector('.react-tabs-list')
    expect(tabList()?.classList.contains('pl-[15px]')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Hide Sidebar' }))
    expect(sidebarHost?.classList.contains('pointer-events-none')).toBe(true)
    expect(sidebarHost?.classList.contains('pointer-events-auto')).toBe(false)
    expect(tabList()?.classList.contains('pl-[25px]')).toBe(true)
    act(() => { vi.advanceTimersByTime(300) })
    const toolbarShowSidebar = screen.getByTestId('react-top-chrome').querySelector<HTMLButtonElement>('[aria-label="Show Sidebar"]')
    expect(toolbarShowSidebar).not.toBeNull()
    fireEvent.mouseEnter(toolbarShowSidebar!)
    expect(document.querySelector('.react-sidebar-host')?.classList.contains('is-hovering')).toBe(true)
    expect(sidebarHost?.classList.contains('pointer-events-auto')).toBe(true)
    expect(sidebarHost?.classList.contains('pointer-events-none')).toBe(false)
    expect(document.querySelector('.react-safety-triangle')?.classList.contains('is-active')).toBe(true)
    expect(screen.getByTestId('react-top-chrome').querySelector('[aria-label="Show Sidebar"]')).not.toBeNull()
    expect(screen.getByRole('complementary', { name: 'Navigation' }).querySelector('[aria-label="Show Sidebar"]')).toBeNull()
    fireEvent.mouseLeave(toolbarShowSidebar!)
    fireEvent.mouseEnter(sidebar)
    act(() => { vi.advanceTimersByTime(200) })
    expect(sidebarHost?.classList.contains('is-hovering')).toBe(true)
    fireEvent.mouseLeave(sidebar)
    act(() => { vi.advanceTimersByTime(200) })
    expect(document.querySelector('.react-sidebar-host')?.classList.contains('is-hovering')).toBe(false)
    expect(sidebarHost?.classList.contains('pointer-events-none')).toBe(true)
    expect(document.querySelector('.react-safety-triangle')?.classList.contains('is-active')).toBe(false)
  })

  it('replaces the native shell context menu with app actions', async () => {
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    fireEvent.contextMenu(screen.getByRole('main'), { clientX: 40, clientY: 48 })

    expect(screen.getByRole('menu', { name: 'App actions' })).not.toBeNull()
    expect(screen.getByRole('menuitem', { name: /Reload/ })).not.toBeNull()
  })

  it('toggles the isolated sidebar without touching Vue state', async () => {
    window.localStorage.setItem('kea-sidebar-open', 'true')
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    expect(screen.getByRole('button', { name: 'Hide Sidebar' }).closest('.react-sidebar')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hide Sidebar' }))
    expect(screen.getByRole('complementary', { name: 'Navigation' })).not.toBeNull()
    expect(screen.getByTestId('react-top-chrome').querySelector('[aria-label="Show Sidebar"]')).not.toBeNull()
  })

  it('closes the sidebar when the viewport becomes narrow', async () => {
    window.localStorage.setItem('kea-sidebar-open', 'true')
    await act(async () => {
      render(<RuntimeProvider port={narrowRuntimePort}><App /></RuntimeProvider>)
    })

    expect(screen.getByTestId('react-top-chrome').querySelector('[aria-label="Show Sidebar"]')).not.toBeNull()
    expect(window.localStorage.getItem('kea-sidebar-open')).toBe('false')
  })

  it('allows the sidebar to be reopened after a narrow viewport closes it', async () => {
    window.localStorage.setItem('kea-sidebar-open', 'true')
    await act(async () => {
      render(<RuntimeProvider port={narrowRuntimePort}><App /></RuntimeProvider>)
    })

    fireEvent.keyDown(document, { key: '\\', ctrlKey: true })
    expect(screen.getByRole('button', { name: 'Hide Sidebar' })).not.toBeNull()
  })

  it('persists and applies the temporary theme preference', async () => {
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }))
    expect(window.localStorage.getItem('kea-theme-preference')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByRole('button', { name: 'Use light theme' })).not.toBeNull()
  })

  it('follows system changes while the preference is system', async () => {
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    systemDark = true
    act(() => systemChangeHandler?.())

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('opens the settings dialog and preserves a saved light preference', async () => {
    window.localStorage.setItem('kea-theme-preference', 'light')
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('opens settings from the configured shortcut and persists settings changes', async () => {
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    fireEvent.keyDown(document, { key: ',', ctrlKey: true })
    expect(screen.getByRole('dialog', { name: 'Settings' })).not.toBeNull()

    fireEvent.click(screen.getByRole('switch', { name: 'Toggle edge glow effect' }))
    expect(JSON.parse(window.localStorage.getItem('kea-settings') ?? '{}')).toMatchObject({
      effects: { edgeGlowEnabled: false },
    })

    fireEvent.click(screen.getByRole('switch', { name: 'Reveal sidebar on edge hover' }))
    expect(JSON.parse(window.localStorage.getItem('kea-settings') ?? '{}')).toMatchObject({
      workspace: { revealSidebarOnEdgeHover: true },
    })
    expect(screen.getByTestId('sidebar-edge-hover-trigger')).not.toBeNull()

    fireEvent.click(screen.getByRole('switch', { name: 'Reveal tabs and toolbar on top hover' }))
    expect(JSON.parse(window.localStorage.getItem('kea-settings') ?? '{}')).toMatchObject({
      workspace: { revealTopChromeOnEdgeHover: true },
    })
    expect(screen.getByTestId('top-chrome-edge-hover-trigger')).not.toBeNull()

    const shortcut = screen.getByRole('button', { name: 'Ctrl+N' })
    fireEvent.click(shortcut)
    fireEvent.keyDown(shortcut, { key: 'k', altKey: true })
    expect(screen.getByRole('button', { name: 'Alt+K' })).not.toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
  })

  it('reveals the sidebar from the window edge when enabled', async () => {
    vi.useFakeTimers()
    window.localStorage.setItem('kea-settings', JSON.stringify({ workspace: { revealSidebarOnEdgeHover: true, revealTopChromeOnEdgeHover: true } }))

    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    const edgeTrigger = screen.getByTestId('sidebar-edge-hover-trigger')
    const sidebarHost = document.querySelector('.react-sidebar-host')
    expect(screen.getByTestId('react-top-chrome').querySelector('[aria-label="Show Sidebar"]')).toBeNull()
    expect(sidebarHost?.classList.contains('is-top-chrome-hidden')).toBe(true)
    fireEvent.mouseEnter(edgeTrigger)
    expect(sidebarHost?.classList.contains('is-hovering')).toBe(true)
    expect(sidebarHost?.classList.contains('is-top-chrome-hidden')).toBe(true)
    expect(screen.getByRole('button', { name: 'Show Sidebar' }).closest('.react-sidebar')).not.toBeNull()
    expect(screen.getByTestId('react-top-chrome').querySelector('[aria-label="Show Sidebar"]')).toBeNull()

    fireEvent.mouseLeave(edgeTrigger)
    act(() => { vi.advanceTimersByTime(200) })
    expect(sidebarHost?.classList.contains('is-hovering')).toBe(false)
    expect(sidebarHost?.classList.contains('is-top-chrome-hidden')).toBe(true)
  })

  it('reveals the tabs and toolbar from the top edge when enabled', async () => {
    vi.useFakeTimers()
    window.localStorage.setItem('kea-settings', JSON.stringify({ workspace: { revealTopChromeOnEdgeHover: true } }))

    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    const edgeTrigger = screen.getByTestId('top-chrome-edge-hover-trigger')
    const topChrome = screen.getByTestId('react-top-chrome')
    const main = screen.getByRole('main')
    const editorContent = main.querySelector('.react-editor-content')
    expect(screen.getByTestId('react-top-chrome').querySelector('[aria-label="Show Sidebar"]')).toBeNull()
    expect(topChrome.classList.contains('is-hover-enabled')).toBe(true)
    expect(topChrome.classList.contains('is-hovering')).toBe(false)
    expect(editorContent?.classList.contains('is-top-chrome-aware')).toBe(true)

    fireEvent.mouseEnter(edgeTrigger)
    expect(topChrome.classList.contains('is-hovering')).toBe(true)
    expect(main.classList.contains('is-top-chrome-visible')).toBe(true)
    expect(screen.getByTestId('react-top-chrome').querySelector('[aria-label="Show Sidebar"]')).not.toBeNull()

    fireEvent.mouseLeave(edgeTrigger)
    act(() => { vi.advanceTimersByTime(200) })
    expect(topChrome.classList.contains('is-hovering')).toBe(false)
    expect(main.classList.contains('is-top-chrome-visible')).toBe(false)
  })

  it('keeps the sidebar toggle in the sidebar actions when the top chrome hides', async () => {
    window.localStorage.setItem('kea-settings', JSON.stringify({ workspace: { revealSidebarOnEdgeHover: true, revealTopChromeOnEdgeHover: true } }))

    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    fireEvent.mouseEnter(screen.getByTestId('sidebar-edge-hover-trigger'))
    const showSidebar = screen.getByRole('button', { name: 'Show Sidebar' })
    expect(showSidebar.closest('.react-sidebar')).not.toBeNull()
    expect(showSidebar.closest('.react-top-chrome')).toBeNull()
    fireEvent.click(showSidebar)
    expect(screen.getByRole('button', { name: 'Hide Sidebar' }).closest('.react-sidebar')).not.toBeNull()
  })

  it('switches back to light mode and ignores system changes for explicit mode', async () => {
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use light theme' }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    systemDark = true
    act(() => systemChangeHandler?.())
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('crosses the document-open boundary and shows a fallback without a document controller', async () => {
    const onOpenFile = vi.fn()
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App workspacePort={markdownWorkspacePort} documentStoragePort={markdownDocumentStoragePort} onOpenFile={onOpenFile} /></RuntimeProvider>)
    })
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Open Folder' })[0]) })
    await act(async () => { fireEvent.click(screen.getByRole('treeitem', { name: 'note.md' })) })
    expect(onOpenFile).toHaveBeenCalledWith('/workspace/note.md')
    expect(screen.getByRole('textbox')).not.toBeNull()
    expect(screen.getByRole('tab', { name: /note.md/ })).not.toBeNull()
  })

  it('restores the saved project and its open document tabs on startup', async () => {
    window.localStorage.setItem('kea-workspace-path:web', '/workspace')
    window.localStorage.setItem(DOCUMENT_SESSIONS_STORAGE_KEY, JSON.stringify({
      'web:/workspace': { paths: ['/workspace/missing.md', '/workspace/note.md'], activePath: '/workspace/note.md' },
    }))

    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App workspacePort={markdownWorkspacePort} documentStoragePort={markdownDocumentStoragePort} /></RuntimeProvider>)
    })
    await act(async () => {})

    expect(screen.getByRole('tree', { name: 'Workspace files' })).not.toBeNull()
    expect(screen.queryByRole('tab', { name: /missing.md/ })).toBeNull()
    expect(screen.getByRole('tab', { name: /note.md/ })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /note.md/ }).getAttribute('aria-selected')).toBe('true')
    expect(window.localStorage.getItem(DOCUMENT_SESSIONS_STORAGE_KEY)).toContain('/workspace/note.md')
  })

  it('mounts the ProseMark editor and formatting toolbar for an active document', async () => {
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App documentStoragePort={markdownDocumentStoragePort} /></RuntimeProvider>)
    })

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Open File' })[0])
    })
    expect(screen.getByTestId('react-prosemark-editor')).not.toBeNull()
    expect(document.querySelector('.prosemark-editor-shell')?.classList.contains('select-text')).toBe(true)
    expect(screen.getByRole('textbox', { name: 'Markdown editor' }).textContent).toBe('Other')
    expect(screen.getByRole('button', { name: 'Bold' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Task list' })).not.toBeNull()
    expect(screen.getByRole('combobox', { name: 'Text style' })).not.toBeNull()
  })

  it('does not retain the obsolete source-mode toggle', async () => {
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    expect(screen.queryByRole('switch', { name: 'Toggle editor mode' })).toBeNull()
    expect(screen.getByRole('button', { name: 'New document' })).not.toBeNull()
  })

  it('creates, switches, and closes React document tabs', async () => {
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App documentStoragePort={markdownDocumentStoragePort} /></RuntimeProvider>)
    })

    fireEvent.click(screen.getByRole('button', { name: 'New document' }))
    expect(screen.getByRole('tab', { name: /Untitled/ })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Close Untitled' }).querySelector('svg.lucide-x')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'New document' }).querySelector('svg.lucide-plus')).not.toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Open File' })[0])
    await act(async () => {})
    expect(screen.getByRole('tab', { name: /other.md/ })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /other.md/ }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Close other.md' }))
    expect(screen.queryByRole('tab', { name: /other.md/ })).toBeNull()
    expect(screen.getByRole('tab', { name: /Untitled/ })).not.toBeNull()
  })
})
