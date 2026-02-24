import {
  EditorSelection,
  type SelectionRange,
  type StateCommand,
} from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { redo, undo } from '@codemirror/commands'
import { closeSearchPanel, openSearchPanel } from '@codemirror/search'
import type { EditorCommand } from '../editorCommands'

function runStateCommand(view: EditorView, command: StateCommand): boolean {
  return command({
    state: view.state,
    dispatch: view.dispatch,
  })
}

function wrapInlineToken(token: string): StateCommand {
  return ({ state, dispatch }) => {
    const update = state.changeByRange((range: SelectionRange) => {
      const selectedText = state.sliceDoc(range.from, range.to)
      const tokenLength = token.length

      const hasTokenBefore =
        range.from >= tokenLength &&
        state.sliceDoc(range.from - tokenLength, range.from) === token
      const hasTokenAfter =
        range.to + tokenLength <= state.doc.length &&
        state.sliceDoc(range.to, range.to + tokenLength) === token

      if (hasTokenBefore && hasTokenAfter) {
        return {
          changes: [
            { from: range.to, to: range.to + tokenLength, insert: '' },
            { from: range.from - tokenLength, to: range.from, insert: '' },
          ],
          range: EditorSelection.range(range.from - tokenLength, range.to - tokenLength),
        }
      }

      const wrappedText = `${token}${selectedText}${token}`
      const cursorStart = range.from + tokenLength

      return {
        changes: { from: range.from, to: range.to, insert: wrappedText },
        range: EditorSelection.range(cursorStart, cursorStart + selectedText.length),
      }
    })

    dispatch(state.update(update, { scrollIntoView: true, userEvent: 'input' }))
    return true
  }
}

function mapSelectedLines(
  view: EditorView,
  transform: (line: string, index: number, lines: string[]) => string
): boolean {
  const state = view.state
  const selection = state.selection.main

  const startLine = state.doc.lineAt(selection.from)
  const endLine = state.doc.lineAt(selection.to)

  const lineBlock = state.sliceDoc(startLine.from, endLine.to)
  const lines = lineBlock.split('\n')
  const updated = lines.map((line, index) => transform(line, index, lines))
  const replacement = updated.join('\n')

  view.dispatch({
    changes: {
      from: startLine.from,
      to: endLine.to,
      insert: replacement,
    },
    selection: {
      anchor: startLine.from,
      head: startLine.from + replacement.length,
    },
    scrollIntoView: true,
    userEvent: 'input',
  })

  return true
}

function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  return mapSelectedLines(view, (line, _index, lines) => {
    if (!line.trim()) return line

    const allPrefixed = lines
      .filter((item) => item.trim().length > 0)
      .every((item) => item.startsWith(prefix))

    if (allPrefixed) {
      return line.startsWith(prefix) ? line.slice(prefix.length) : line
    }

    return `${prefix}${line}`
  })
}

function toggleOrderedList(view: EditorView): boolean {
  return mapSelectedLines(view, (line, index, lines) => {
    if (!line.trim()) return line

    const allOrdered = lines
      .filter((item) => item.trim().length > 0)
      .every((item) => /^\d+\.\s+/.test(item))

    if (allOrdered) {
      return line.replace(/^\d+\.\s+/, '')
    }

    return `${index + 1}. ${line.replace(/^[-*+]\s+/, '')}`
  })
}

function setHeading(view: EditorView, level: 0 | 1 | 2 | 3 | 4 | 5 | 6): boolean {
  return mapSelectedLines(view, (line) => {
    if (!line.trim()) return line

    const withoutHeading = line.replace(/^#{1,6}\s+/, '')
    if (level === 0) {
      return withoutHeading
    }

    return `${'#'.repeat(level)} ${withoutHeading}`
  })
}

function insertCodeBlock(view: EditorView): boolean {
  const state = view.state
  const selection = state.selection.main
  const selectedText = state.sliceDoc(selection.from, selection.to)
  const hasSelection = selectedText.length > 0
  const markdown = hasSelection ? `\`\`\`\n${selectedText}\n\`\`\`` : '```\n\n```'
  const selectionStart = selection.from + 4
  const selectionEnd = hasSelection ? selectionStart + selectedText.length : selectionStart

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: markdown },
    selection: {
      anchor: selectionStart,
      head: selectionEnd,
    },
    scrollIntoView: true,
    userEvent: 'input',
  })

  return true
}

function insertHorizontalRule(view: EditorView): boolean {
  const state = view.state
  const selection = state.selection.main
  const beforeChar = selection.from > 0 ? state.sliceDoc(selection.from - 1, selection.from) : '\n'
  const afterChar = selection.to < state.doc.length ? state.sliceDoc(selection.to, selection.to + 1) : '\n'
  const prefix = beforeChar === '\n' ? '' : '\n'
  const suffix = afterChar === '\n' ? '' : '\n'
  const markdown = `${prefix}---${suffix}`
  const cursor = selection.from + markdown.length

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: markdown },
    selection: {
      anchor: cursor,
      head: cursor,
    },
    scrollIntoView: true,
    userEvent: 'input',
  })

  return true
}

function insertLink(view: EditorView): boolean {
  const state = view.state
  const selection = state.selection.main
  const selectedText = state.sliceDoc(selection.from, selection.to)
  const linkText = selectedText || 'link text'
  const markdown = `[${linkText}](https://)`

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: markdown },
    selection: {
      anchor: selection.from + 1,
      head: selection.from + 1 + linkText.length,
    },
    scrollIntoView: true,
    userEvent: 'input',
  })

  return true
}

function insertImage(view: EditorView): boolean {
  const state = view.state
  const selection = state.selection.main
  const markdown = '![image](./assets/image.png)'

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: markdown },
    selection: {
      anchor: selection.from + 2,
      head: selection.from + 7,
    },
    scrollIntoView: true,
    userEvent: 'input',
  })

  return true
}

function toggleFindPanel(view: EditorView): boolean {
  const hasSearchPanel = view.dom.querySelector('.cm-search') !== null
  if (hasSearchPanel) {
    return closeSearchPanel(view)
  }

  return openSearchPanel(view)
}

function runCommand(view: EditorView, command: EditorCommand): boolean {
  switch (command) {
    case 'undo':
      return runStateCommand(view, undo)
    case 'redo':
      return runStateCommand(view, redo)
    case 'find':
      return toggleFindPanel(view)
    case 'bold':
      return runStateCommand(view, wrapInlineToken('**'))
    case 'italic':
      return runStateCommand(view, wrapInlineToken('*'))
    case 'strikethrough':
      return runStateCommand(view, wrapInlineToken('~~'))
    case 'code':
      return runStateCommand(view, wrapInlineToken('`'))
    case 'code-block':
      return insertCodeBlock(view)
    case 'insert-highlight':
      return runStateCommand(view, wrapInlineToken('=='))
    case 'insert-hr':
      return insertHorizontalRule(view)
    case 'blockquote':
      return toggleLinePrefix(view, '> ')
    case 'bullet-list':
      return toggleLinePrefix(view, '- ')
    case 'ordered-list':
      return toggleOrderedList(view)
    case 'task-list':
      return toggleLinePrefix(view, '- [ ] ')
    case 'heading-paragraph':
      return setHeading(view, 0)
    case 'heading-1':
      return setHeading(view, 1)
    case 'heading-2':
      return setHeading(view, 2)
    case 'heading-3':
      return setHeading(view, 3)
    case 'heading-4':
      return setHeading(view, 4)
    case 'heading-5':
      return setHeading(view, 5)
    case 'heading-6':
      return setHeading(view, 6)
    case 'insert-link':
      return insertLink(view)
    case 'insert-image':
      return insertImage(view)
  }
}

export function runEditorCommand(view: EditorView, command: EditorCommand): boolean {
  return runCommand(view, command)
}

export function buildEditorCommandKeymap() {
  return [
    { key: 'Mod-b', run: (view: EditorView) => runEditorCommand(view, 'bold') },
    { key: 'Mod-i', run: (view: EditorView) => runEditorCommand(view, 'italic') },
    { key: 'Mod-`', run: (view: EditorView) => runEditorCommand(view, 'code') },
    { key: 'Mod-Shift-h', run: (view: EditorView) => runEditorCommand(view, 'insert-highlight') },
  ]
}
