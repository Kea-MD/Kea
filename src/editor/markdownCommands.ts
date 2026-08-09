import { EditorSelection } from '@codemirror/state'
import { redo, redoDepth, undo, undoDepth } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import { EditorView, type KeyBinding } from '@codemirror/view'
import { prosemarkMarkdownFormattingKeymap } from '@prosemark/core'
import type { EditorCommand, EditorController } from '../core/contracts/editor'

function runProseMarkBinding(view: EditorView, key: string): boolean {
  const binding = prosemarkMarkdownFormattingKeymap.find(item => item.key === key) as KeyBinding | undefined
  return binding?.run?.(view) ?? false
}

function transformLines(view: EditorView, transform: (line: string, index: number) => string): boolean {
  const range = view.state.selection.main
  const first = view.state.doc.lineAt(range.from)
  const last = view.state.doc.lineAt(range.to)
  const lines = view.state.doc.sliceString(first.from, last.to).split('\n')
  const replacement = lines.map(transform).join('\n')
  view.dispatch({
    changes: { from: first.from, to: last.to, insert: replacement },
    selection: EditorSelection.range(first.from, first.from + replacement.length),
    userEvent: 'input.format.block',
  })
  view.focus()
  return true
}

function togglePrefix(view: EditorView, prefix: string, matcher: RegExp): boolean {
  const selection = view.state.selection.main
  const source = view.state.doc.sliceString(
    view.state.doc.lineAt(selection.from).from,
    view.state.doc.lineAt(selection.to).to,
  ).split('\n')
  const remove = source.every(line => matcher.test(line))
  return transformLines(view, line => remove ? line.replace(matcher, '') : `${prefix}${line.replace(matcher, '')}`)
}

function insert(view: EditorView, source: string, selectFrom = source.length, selectLength = 0): boolean {
  const range = view.state.selection.main
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: source },
    selection: EditorSelection.range(range.from + selectFrom, range.from + selectFrom + selectLength),
    userEvent: 'input.format.insert',
  })
  view.focus()
  return true
}

export function executeMarkdownCommand(view: EditorView, command: EditorCommand): boolean {
  if (command === 'undo') return undo(view)
  if (command === 'redo') return redo(view)
  if (command === 'find' || command === 'replace') return openSearchPanel(view)

  const prosemarkKeys: Partial<Record<EditorCommand, string>> = {
    bold: 'Mod-b',
    italic: 'Mod-i',
    code: 'Mod-`',
    'insert-link': 'Mod-k',
    strikethrough: 'Mod-Shift-x',
  }
  const prosemarkKey = prosemarkKeys[command]
  if (prosemarkKey) return runProseMarkBinding(view, prosemarkKey)

  if (command === 'heading-paragraph') return transformLines(view, line => line.replace(/^#{1,6}\s+/, ''))
  if (command.startsWith('heading-')) {
    const level = Number(command.slice('heading-'.length))
    if (level >= 1 && level <= 6) return transformLines(view, line => `${'#'.repeat(level)} ${line.replace(/^#{1,6}\s+/, '')}`)
  }
  if (command === 'blockquote') return togglePrefix(view, '> ', /^>\s?/)
  if (command === 'bullet-list') return togglePrefix(view, '- ', /^[-+*]\s+/)
  if (command === 'ordered-list') return transformLines(view, (line, index) => `${index + 1}. ${line.replace(/^\d+[.)]\s+/, '')}`)
  if (command === 'task-list') return togglePrefix(view, '- [ ] ', /^[-+*]\s+\[[ xX]\]\s+/)

  const selected = view.state.doc.sliceString(view.state.selection.main.from, view.state.selection.main.to)
  if (command === 'code-block') {
    const body = selected || 'code'
    return insert(view, `\`\`\`\n${body}\n\`\`\``, 4, body.length)
  }
  if (command === 'insert-image') return insert(view, '![image description](image.png)', 2, 'image description'.length)
  if (command === 'insert-hr') return insert(view, '---\n')
  if (command === 'insert-mermaid') {
    const body = 'flowchart LR\n  A[Start] --> B[End]'
    return insert(view, `\`\`\`mermaid\n${body}\n\`\`\``, '```mermaid\n'.length, body.length)
  }
  if (command === 'insert-math') return insert(view, '$$\nE = mc^2\n$$', 3, 'E = mc^2'.length)
  if (command === 'insert-table') {
    const table = '| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |'
    return insert(view, table, 2, 'Column 1'.length)
  }
  return false
}

export function createCodeMirrorController(view: EditorView): EditorController {
  return {
    execute: command => executeMarkdownCommand(view, command),
    getCapabilities: () => ({
      canUndo: undoDepth(view.state) > 0,
      canRedo: redoDepth(view.state) > 0,
    }),
    getContent: () => view.state.doc.toString(),
    getSelection: () => ({ from: view.state.selection.main.from, to: view.state.selection.main.to }),
    revealPosition: position => {
      const cursor = Math.min(Math.max(0, position), view.state.doc.length)
      view.dispatch({ selection: EditorSelection.cursor(cursor), effects: EditorView.scrollIntoView(cursor, { y: 'center' }) })
      view.focus()
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  }
}
