import { describe, expect, it, vi } from 'vitest'
import { dispatchDocumentCommand } from '../../src/modules/editor/state/dispatchDocumentCommand'

describe('dispatchDocumentCommand', () => {
  it('runs apply between normalise and reconcile stages and returns apply result', () => {
    const sequence: string[] = []
    const command = {
      type: 'updateContent',
      source: 'local',
      documentId: 'doc-1',
      path: '/workspace/note.md',
      contentLength: 42,
    } as const

    const result = dispatchDocumentCommand({
      command,
      apply: () => {
        sequence.push('apply')
        return 'done'
      },
      hooks: {
        normalise: () => sequence.push('normalise'),
        reconcile: () => sequence.push('reconcile'),
        persist: () => sequence.push('persist'),
        broadcast: () => sequence.push('broadcast'),
      },
    })

    expect(result).toBe('done')
    expect(sequence).toEqual(['normalise', 'apply', 'reconcile', 'persist', 'broadcast'])
  })

  it('supports dispatch with no optional hooks', () => {
    const apply = vi.fn(() => 123)

    const result = dispatchDocumentCommand({
      command: {
        type: 'createDocument',
        source: 'local',
        documentId: 'doc-2',
        contentLength: 0,
      },
      apply,
    })

    expect(result).toBe(123)
    expect(apply).toHaveBeenCalledTimes(1)
  })
})
