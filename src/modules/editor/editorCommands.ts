export type {
  EditorCommand,
  EditorCommandEventDetail,
  EditorMode,
  EditorUiStateEventDetail,
} from '../../core/contracts/editor'
import type {
  EditorCommand,
  EditorCommandEventDetail,
  EditorUiStateEventDetail,
} from '../../core/contracts/editor'

const EDITOR_COMMAND_EVENT = 'kea-editor-command'
const EDITOR_UI_STATE_EVENT = 'kea-editor-ui-state'

export function dispatchEditorCommand(command: EditorCommand, payload?: unknown) {
  window.dispatchEvent(
    new CustomEvent<EditorCommandEventDetail>(EDITOR_COMMAND_EVENT, {
      detail: {
        command,
        payload,
      },
    })
  )
}

export function addEditorCommandListener(
  handler: (detail: EditorCommandEventDetail) => void
): () => void {
  const listener: EventListener = (event) => {
    const customEvent = event as CustomEvent<EditorCommandEventDetail>
    if (!customEvent.detail) return
    handler(customEvent.detail)
  }

  window.addEventListener(EDITOR_COMMAND_EVENT, listener)

  return () => {
    window.removeEventListener(EDITOR_COMMAND_EVENT, listener)
  }
}

export function dispatchEditorUiState(detail: EditorUiStateEventDetail) {
  window.dispatchEvent(
    new CustomEvent<EditorUiStateEventDetail>(EDITOR_UI_STATE_EVENT, {
      detail,
    })
  )
}

export function addEditorUiStateListener(
  handler: (detail: EditorUiStateEventDetail) => void
): () => void {
  const listener: EventListener = (event) => {
    const customEvent = event as CustomEvent<EditorUiStateEventDetail>
    if (!customEvent.detail) return
    handler(customEvent.detail)
  }

  window.addEventListener(EDITOR_UI_STATE_EVENT, listener)

  return () => {
    window.removeEventListener(EDITOR_UI_STATE_EVENT, listener)
  }
}
