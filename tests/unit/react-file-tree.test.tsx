import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileTree } from '../../src/workspace/FileTree'
import type { WorkspaceFileEntry } from '../../src/workspace/workspaceModel'

const entries: WorkspaceFileEntry[] = [
  {
    name: 'docs',
    path: '/workspace/docs',
    is_dir: true,
    is_markdown: false,
    children: [{ name: 'draft.md', path: '/workspace/docs/draft.md', is_dir: false, is_markdown: true }],
  },
  { name: 'README.md', path: '/workspace/README.md', is_dir: false, is_markdown: true },
]

function renderTree(expandedPaths = new Set<string>()) {
  return render(<FileTree
    entries={entries}
    rootPath="/workspace"
    expandedPaths={expandedPaths}
    activePath={null}
    renamePath={null}
    onToggle={vi.fn()}
    onSelectFile={vi.fn()}
    onRename={async () => true}
    onRenameRequest={vi.fn()}
    onContextMenu={vi.fn()}
    onMove={async () => undefined}
  />)
}

describe('React file tree', () => {
  it('uses a custom overlay carriage with the native scrollbar hidden', () => {
    const { container } = renderTree()

    expect(screen.getByRole('tree', { name: 'Workspace files' }).classList.contains('react-custom-scroll-source')).toBe(true)
    expect(container.querySelector('.straight-overlay-scrollbar')).not.toBeNull()
  })

  it('filters entries by name and expands matching parent folders', () => {
    renderTree()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search files' }), { target: { value: 'draft' } })

    expect(screen.getByText('draft.md')).not.toBeNull()
    expect(screen.getByText('docs')).not.toBeNull()
    expect(screen.queryByText('README.md')).toBeNull()
    expect(screen.getByRole('treeitem', { name: 'docs' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('clears the filter and restores the complete tree', () => {
    renderTree(new Set(['/workspace/docs']))
    const search = screen.getByRole('searchbox', { name: 'Search files' })

    fireEvent.change(search, { target: { value: 'draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear file search' }))

    expect(screen.getByText('README.md')).not.toBeNull()
    expect((search as HTMLInputElement).value).toBe('')
    expect(screen.getByText('draft.md')).not.toBeNull()
  })
})
