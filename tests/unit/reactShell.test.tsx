import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { RuntimeProvider } from '../../src/runtime/RuntimeContext'
import type { RuntimePort } from '../../src/core/contracts'
import type { DocumentStoragePort } from '../../src/core/contracts/document'
import type { WorkspacePort } from '../../src/core/contracts/workspace'

const testRuntimePort: RuntimePort = {
  getInitialContext: () => ({ isTauri: false, isMac: false, isMobile: false }),
  readFullscreen: () => Promise.resolve(false),
  subscribeMobile: () => () => {},
  subscribeWindowState: () => Promise.resolve(() => {}),
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
}

const markdownDocumentStoragePort: DocumentStoragePort = {
  readFile: path => Promise.resolve({ path, name: path.split('/').pop() ?? 'note.md', content: '# Note\n', }),
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

  it('renders the shell controls and empty editor state', async () => {
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    expect(screen.getByRole('main')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'No file open' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Show Sidebar' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'New document' })).not.toBeNull()
    const tabList = () => screen.getByRole('tablist').querySelector('.react-tabs-list')
    expect(tabList()?.classList.contains('pl-[25px]')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Show Sidebar' }))
    expect(tabList()?.classList.contains('pl-[15px]')).toBe(true)
  })

  it('toggles the isolated sidebar without touching Vue state', async () => {
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App /></RuntimeProvider>)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Show Sidebar' }))
    expect(screen.getByRole('complementary', { name: 'Navigation' })).not.toBeNull()
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

    const shortcut = screen.getByRole('button', { name: 'Ctrl+N' })
    fireEvent.click(shortcut)
    fireEvent.keyDown(shortcut, { key: 'k', altKey: true })
    expect(screen.getByRole('button', { name: 'Alt+K' })).not.toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
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

  it('mounts the ProseMark editor and formatting toolbar for an active document', async () => {
    await act(async () => {
      render(<RuntimeProvider port={testRuntimePort}><App documentStoragePort={markdownDocumentStoragePort} /></RuntimeProvider>)
    })

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Open File' })[0])
    })
    expect(screen.getByTestId('react-prosemark-editor')).not.toBeNull()
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
    expect(screen.getByRole('button', { name: 'Close Untitled' }).querySelector('.pi.pi-times')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'New document' }).querySelector('.pi.pi-plus')).not.toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Open File' })[0])
    await act(async () => {})
    expect(screen.getByRole('tab', { name: /other.md/ })).not.toBeNull()
    expect(screen.getByRole('tab', { name: /other.md/ }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Close other.md' }))
    expect(screen.queryByRole('tab', { name: /other.md/ })).toBeNull()
    expect(screen.getByRole('tab', { name: /Untitled/ })).not.toBeNull()
  })
})
