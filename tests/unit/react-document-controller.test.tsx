import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocumentController } from '../../src/editor/useDocumentController'
import type { DocumentStoragePort } from '../../src/core/contracts/document'

let diskContent = 'initial'
const port: DocumentStoragePort = {
  readFile: vi.fn(path => path === '/workspace/missing.md'
    ? Promise.reject('missing')
    : Promise.resolve({ path, name: path.split('/').pop() ?? 'note.md', content: diskContent })),
  openMarkdownFile: () => Promise.resolve({ path: '/workspace/picked.md', name: 'picked.md', content: 'picked' }),
  saveMarkdownFile: vi.fn(() => Promise.resolve()),
  saveMarkdownFileAs: vi.fn(() => Promise.resolve({ path: '/workspace/saved.md', name: 'saved.md' })),
}

function Harness() {
  const controller = useDocumentController(port)
  return (
    <div>
      <output data-testid="documents">{controller.documents.map(document => `${document.name}:${document.isDirty ? 'dirty' : 'clean'}`).join('|')}</output>
      <output data-testid="active">{controller.activeDocument?.path ?? 'none'}</output>
      <output data-testid="content">{controller.activeDocument?.content ?? 'none'}</output>
      <output data-testid="revision">{controller.activeDocument?.contentRevision ?? -1}</output>
      <button type="button" onClick={() => void controller.openFileFromPath('/workspace/note.md')}>Open</button>
      <button type="button" onClick={() => void controller.openFileDialog()}>Pick</button>
      <button type="button" onClick={() => void controller.restoreDocuments(['/workspace/note.md', '/workspace/missing.md'], '/workspace/note.md')}>Restore</button>
      <button type="button" onClick={controller.newFile}>New</button>
      <button type="button" onClick={() => controller.reorderDocuments(1, 0)}>Reorder</button>
      <button type="button" onClick={() => controller.updateContent('changed')}>Change</button>
      <button type="button" onClick={() => controller.updateContent('changed again')}>Change again</button>
      <button type="button" onClick={() => void controller.saveFile()}>Save</button>
      <button type="button" onClick={() => void controller.saveFileAs()}>Save As</button>
      <button type="button" onClick={() => void controller.closeDocument(controller.activeDocumentId ?? '')}>Close</button>
      <button type="button" onClick={() => controller.updatePathsAfterRename('/workspace', '/renamed', true)}>Rename</button>
      <button type="button" onClick={() => void controller.checkExternalChange('/workspace/note.md', 'modified')}>External</button>
      <button type="button" onClick={() => void controller.checkExternalChange('/workspace/note.md', 'removed')}>Removed event</button>
    </div>
  )
}

describe('React document controller', () => {
  beforeEach(() => {
    vi.mocked(port.saveMarkdownFile).mockClear()
    vi.mocked(port.saveMarkdownFileAs).mockClear()
    vi.mocked(port.readFile).mockClear()
    diskContent = 'initial'
  })

  it('opens files, deduplicates paths, and updates the active tab', async () => {
    render(<Harness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open' })) })
    expect(screen.getByTestId('documents').textContent).toBe('note.md:clean')
    expect(screen.getByTestId('active').textContent).toBe('/workspace/note.md')
  })

  it('restores available documents in order and skips unavailable paths', async () => {
    render(<Harness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restore' })) })
    expect(screen.getByTestId('documents').textContent).toBe('note.md:clean')
    expect(screen.getByTestId('active').textContent).toBe('/workspace/note.md')
    expect(port.readFile).toHaveBeenCalledWith('/workspace/missing.md')
  })

  it('keeps dirty documents until discard is confirmed and saves content', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Harness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'New' })) })
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Close' })) })
    expect(screen.getByTestId('documents').textContent).toBe('Untitled:dirty')
    expect(confirm).toHaveBeenCalledOnce()

    confirm.mockReturnValue(true)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Close' })) })
    expect(screen.getByTestId('documents').textContent).toBe('')
    confirm.mockRestore()
  })

  it('saves a named file and save-as updates an untitled document path', async () => {
    render(<Harness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open' })) })
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(port.saveMarkdownFile).toHaveBeenCalledWith('/workspace/note.md', 'changed')
    expect(screen.getByTestId('documents').textContent).toBe('note.md:clean')

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'New' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save As' })) })
    expect(port.saveMarkdownFileAs).toHaveBeenCalledWith('')
    expect(screen.getByTestId('active').textContent).toBe('/workspace/saved.md')
  })

  it('does not replace edits made while an earlier save is in flight', async () => {
    let finishSave: (() => void) | undefined
    vi.mocked(port.saveMarkdownFile).mockImplementationOnce(() => new Promise<void>(resolve => {
      finishSave = resolve
    }))
    render(<Harness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open' })) })
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change again' }))
    await act(async () => { finishSave?.() })

    expect(port.saveMarkdownFile).toHaveBeenCalledWith('/workspace/note.md', 'changed')
    expect(screen.getByTestId('content').textContent).toBe('changed again')
    expect(screen.getByTestId('documents').textContent).toBe('note.md:dirty')
  })

  it('rewrites open document paths when a workspace directory is renamed', async () => {
    render(<Harness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open' })) })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(screen.getByTestId('active').textContent).toBe('/renamed/note.md')
  })

  it('reorders documents without changing the active document', async () => {
    render(<Harness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open' })) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'New' })) })
    expect(screen.getByTestId('active').textContent).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Reorder' }))
    expect(screen.getByTestId('documents').textContent).toBe('Untitled:clean|note.md:clean')
    expect(screen.getByTestId('active').textContent).toBe('')
  })

  it('applies external edits immediately to both clean and dirty documents', async () => {
    render(<Harness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open' })) })
    diskContent = 'changed on disk'
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'External' })) })
    expect(screen.getByTestId('content').textContent).toBe('changed on disk')
    expect(screen.getByTestId('revision').textContent).toBe('1')

    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    diskContent = 'newer disk copy'
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'External' })) })
    expect(screen.getByTestId('content').textContent).toBe('newer disk copy')
    expect(screen.getByTestId('revision').textContent).toBe('2')
    expect(screen.getByTestId('documents').textContent).toBe('note.md:clean')
  })

  it('does not replay Kea autosaves as external edits', async () => {
    render(<Harness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open' })) })
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    diskContent = 'changed'

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'External' })) })

    expect(screen.getByTestId('content').textContent).toBe('changed')
    expect(screen.getByTestId('revision').textContent).toBe('0')
  })

  it('does not close a document when an atomic replacement emits a removed event', async () => {
    render(<Harness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open' })) })
    diskContent = 'atomically replaced'

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Removed event' })) })

    expect(screen.getByTestId('active').textContent).toBe('/workspace/note.md')
    expect(screen.getByTestId('content').textContent).toBe('atomically replaced')
    expect(screen.getByTestId('revision').textContent).toBe('1')
  })
})
