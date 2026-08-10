import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DocumentSnapshot } from '../../src/core/contracts/document'
import { EditorSurface } from '../../src/editor/EditorSurface'

const callbacks = {
  onChange: vi.fn(),
  onEditorChange: vi.fn(),
  onEditorStateChange: vi.fn(),
  onOpenLink: vi.fn(),
}

function snapshot(content: string, contentRevision: number): DocumentSnapshot {
  return {
    id: 'document',
    path: '/workspace/note.md',
    name: 'note.md',
    content,
    savedContent: content,
    isDirty: false,
    contentRevision,
  }
}

describe('ProseMark editor lifecycle', () => {
  it('keeps one editor instance across local publications and external updates', async () => {
    const { container, rerender } = render(<EditorSurface document={snapshot('Initial', 0)} {...callbacks} />)
    const editor = container.querySelector('.cm-editor')
    expect(editor).not.toBeNull()
    expect(container.querySelector('.cm-content')?.textContent).toBe('Initial')

    rerender(<EditorSurface document={snapshot('Local state publication', 0)} {...callbacks} />)
    expect(container.querySelector('.cm-editor')).toBe(editor)
    expect(container.querySelector('.cm-content')?.textContent).toBe('Initial')

    await act(async () => {
      rerender(<EditorSurface document={snapshot('External update', 1)} {...callbacks} />)
    })
    expect(container.querySelector('.cm-editor')).toBe(editor)
    expect(container.querySelector('.cm-content')?.textContent).toBe('External update')
  })
})
