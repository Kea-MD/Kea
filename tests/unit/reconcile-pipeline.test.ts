import { describe, expect, it } from 'vitest'
import { runReconcilePipeline } from '../../src/modules/editor/state/reconcilePipeline'

describe('runReconcilePipeline', () => {
  it('runs stages in order with the same command context', () => {
    const sequence: string[] = []
    const command = { type: 'updateContent', id: 'doc-1' }

    const context = runReconcilePipeline(command, [
      ({ command: next }) => {
        sequence.push(`one:${next.type}`)
      },
      ({ command: next }) => {
        sequence.push(`two:${next.id}`)
      },
    ])

    expect(context.command).toBe(command)
    expect(sequence).toEqual(['one:updateContent', 'two:doc-1'])
  })

  it('returns context unchanged when no stages are provided', () => {
    const command = { type: 'noop' }
    const context = runReconcilePipeline(command, [])

    expect(context).toEqual({ command })
  })
})
