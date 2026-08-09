import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocumentController } from '../../src/editor/useDocumentController'
import type { DocumentStoragePort } from '../../src/core/contracts/document'

let diskContent = 'initial'
const port: DocumentStoragePort = {
  readFile: vi.fn(path => Promise.resolve({ path, name: path.split('/').pop() ?? 'note.md', content: diskContent })),
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
      <output data-testid="conflict">{controller.externalChange?.kind ?? 'none'}</output>
      <button type="button" onClick={() => void controller.openFileFromPath('/workspace/note.md')}>Open</button>
      <button type="button" onClick={() => void controller.openFileDialog()}>Pick</button>
      <button type="button" onClick={controller.newFile}>New</button>
      <button type="button" onClick={() => controller.reorderDocuments(1, 0)}>Reorder</button>
      <button type="button" onClick={() => controller.updateContent('changed')}>Change</button>
      <button type="button" onClick={() => void controller.saveFile()}>Save</button>
      <button type="button" onClick={() => void controller.saveFileAs()}>Save As</button>
      <button type="button" onClick={() => void controller.closeDocument(controller.activeDocumentId ?? '')}>Close</button>
      <button type="button" onClick={() => controller.updatePathsAfterRename('/workspace', '/renamed', true)}>Rename</button>
      <button type="button" onClick={() => void controller.checkExternalChange('/workspace/note.md', 'modified')}>External</button>
      <button type="button" onClick={controller.acceptExternalChange}>Accept external</button>
      <button type="button" onClick={controller.keepLocalVersion}>Keep local</button>
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

  it('reloads clean external edits and asks before replacing dirty content', async () => {
    render(<Harness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open' })) })
    diskContent = 'changed on disk'
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'External' })) })
    expect(screen.getByTestId('content').textContent).toBe('changed on disk')
    expect(screen.getByTestId('conflict').textContent).toBe('none')

    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    diskContent = 'newer disk copy'
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'External' })) })
    expect(screen.getByTestId('content').textContent).toBe('changed')
    expect(screen.getByTestId('conflict').textContent).toBe('modified')
    fireEvent.click(screen.getByRole('button', { name: 'Accept external' }))
    expect(screen.getByTestId('content').textContent).toBe('newer disk copy')
    expect(screen.getByTestId('documents').textContent).toBe('note.md:clean')
  })
})
