import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { prosemarkBasicSetup, prosemarkMarkdownSyntaxExtensions } from '@prosemark/core'
import { afterEach, describe, expect, it } from 'vitest'

let view: EditorView | null = null

function longMarkdown(bytes: number): string {
  const section = '# Heading\n\nA paragraph with **bold**, [a link](other.md), and `code`.\n\n- [ ] task\n\n'
  return section.repeat(Math.ceil(bytes / section.length)).slice(0, bytes)
}

afterEach(() => {
  view?.destroy()
  view?.dom.parentElement?.remove()
  view = null
})

describe('long Markdown documents', () => {
  it('opens and edits a 1 MB document through the real ProseMark editor setup', { timeout: 15_000 }, () => {
    const content = longMarkdown(1024 * 1024)
    const parent = document.createElement('div')
    document.body.append(parent)
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: content,
        extensions: [markdown({ extensions: [GFM, prosemarkMarkdownSyntaxExtensions] }), prosemarkBasicSetup()],
      }),
    })
    view.dispatch({ changes: { from: content.length, insert: '\nlast edit' } })
    expect(view.state.doc.length).toBe(content.length + 10)
  })

  it('keeps a 5 MB document incremental instead of rejecting it by size', { timeout: 15_000 }, () => {
    const content = longMarkdown(5 * 1024 * 1024)
    let state = EditorState.create({ doc: content, extensions: markdown({ extensions: [GFM, prosemarkMarkdownSyntaxExtensions] }) })
    state = state.update({ changes: { from: state.doc.length - 1, to: state.doc.length, insert: '!' } }).state
    expect(state.doc.length).toBe(content.length)
    expect(state.doc.sliceString(state.doc.length - 1)).toBe('!')
  })
})
