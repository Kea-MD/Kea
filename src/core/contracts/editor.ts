export type EditorMode = 'source' | 'rendered'

export type EditorCommand =
  | 'undo' | 'redo' | 'find' | 'replace'
  | 'bold' | 'italic' | 'strikethrough' | 'code'
  | 'code-block' | 'blockquote' | 'bullet-list' | 'ordered-list' | 'task-list'
  | 'insert-link' | 'insert-image' | 'insert-hr' | 'insert-highlight'
  | 'insert-mermaid' | 'insert-math' | 'insert-table'
  | 'heading-paragraph' | 'heading-1' | 'heading-2' | 'heading-3' | 'heading-4'
  | 'heading-5' | 'heading-6'

export interface EditorCommandEventDetail {
  command: EditorCommand
  payload?: unknown
}

export interface EditorUiStateEventDetail {
  findOpen?: boolean
  canUndo?: boolean
  canRedo?: boolean
}

export interface EditorSelection {
  from: number
  to: number
}

export interface EditorCapabilities {
  canUndo: boolean
  canRedo: boolean
}

export interface EditorController {
  execute: (command: EditorCommand) => boolean
  getCapabilities: () => EditorCapabilities
  getContent: () => string
  getSelection: () => EditorSelection | null
  revealPosition: (position: number) => void
  focus: () => void
  destroy: () => void
}
