import { describe, expect, it, vi } from 'vitest'
import {
  addEditorCommandListener,
  addEditorUiStateListener,
  dispatchEditorCommand,
  dispatchEditorUiState,
} from '../../src/modules/editor/editorCommands'

describe('editorCommands events', () => {
  it('dispatches editor command events to listeners and supports unsubscribe', () => {
    const handler = vi.fn()
    const unlisten = addEditorCommandListener(handler)

    dispatchEditorCommand('bold', { source: 'toolbar' })

    expect(handler).toHaveBeenCalledWith({ command: 'bold', payload: { source: 'toolbar' } })

    unlisten()
    dispatchEditorCommand('italic')

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('ignores command events without detail payload', () => {
    const handler = vi.fn()
    const unlisten = addEditorCommandListener(handler)

    window.dispatchEvent(new CustomEvent('kea-editor-command'))

    expect(handler).not.toHaveBeenCalled()
    unlisten()
  })

  it('dispatches ui-state events to listeners and supports unsubscribe', () => {
    const handler = vi.fn()
    const unlisten = addEditorUiStateListener(handler)

    dispatchEditorUiState({ findOpen: true, canUndo: true, canRedo: false })

    expect(handler).toHaveBeenCalledWith({ findOpen: true, canUndo: true, canRedo: false })

    unlisten()
    dispatchEditorUiState({ canUndo: false })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('ignores ui-state events without detail payload', () => {
    const handler = vi.fn()
    const unlisten = addEditorUiStateListener(handler)

    window.dispatchEvent(new CustomEvent('kea-editor-ui-state'))

    expect(handler).not.toHaveBeenCalled()
    unlisten()
  })
})
