import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DocumentSnapshot } from '../../src/core/contracts/document'
import { useReactAutoSave } from '../../src/editor/useReactAutoSave'

function Harness({ document, save }: { document: DocumentSnapshot; save: () => Promise<boolean> }) {
  useReactAutoSave(document, save, 100)
  return null
}

describe('React autosave', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules another save when an earlier save completed behind newer edits', async () => {
    vi.useFakeTimers()
    const save = vi.fn(() => Promise.resolve(true))
    const document: DocumentSnapshot = {
      id: 'document',
      path: '/workspace/note.md',
      name: 'note.md',
      content: 'newer edit',
      savedContent: 'initial',
      isDirty: true,
      contentRevision: 0,
    }
    const { rerender } = render(<Harness document={document} save={save} />)

    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(save).toHaveBeenCalledTimes(1)

    rerender(<Harness document={{ ...document, savedContent: 'older saved edit' }} save={save} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(save).toHaveBeenCalledTimes(2)
  })
})
