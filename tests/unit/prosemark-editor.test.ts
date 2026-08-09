import { markdown } from '@codemirror/lang-markdown'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { prosemarkMarkdownSyntaxExtensions } from '@prosemark/core'
import { afterEach, describe, expect, it } from 'vitest'
import { parseMarkdownTable, parseTableCellInlineMarkdown } from '../../src/editor/extensions/table'
import { renderMermaid, sanitiseMermaidSvg } from '../../src/editor/extensions/mermaidRenderer'
import { executeMarkdownCommand } from '../../src/editor/markdownCommands'
import { extractMarkdownHeadings } from '../../src/editor/markdownHeadings'
import { resolveMarkdownLink } from '../../src/editor/linkNavigation'

let view: EditorView | null = null

function createView(content: string, from = 0, to = content.length): EditorView {
  const parent = document.createElement('div')
  document.body.append(parent)
  view = new EditorView({
    parent,
    state: EditorState.create({
      doc: content,
      selection: EditorSelection.range(from, to),
      extensions: markdown({ extensions: [GFM, prosemarkMarkdownSyntaxExtensions] }),
    }),
  })
  return view
}

afterEach(() => {
  view?.dom.parentElement?.remove()
  view?.destroy()
  view = null
})

describe('ProseMark editor extensions', () => {
  it('parses aligned GFM tables with escaped pipes and missing cells', () => {
    const table = parseMarkdownTable([
      '| Left | Centre | Right |',
      '| :--- | :---: | ---: |',
      '| one \\| two | **bold** | 3 |',
      '| four | five | |',
    ].join('\n'))

    expect(table).toEqual({
      headers: ['Left', 'Centre', 'Right'],
      alignments: ['left', 'center', 'right'],
      rows: [
        ['one \\| two', '**bold**', '3'],
        ['four', 'five', ''],
      ],
    })
  })

  it('rejects text that only resembles a table', () => {
    expect(parseMarkdownTable('| A | B |\n| one | two |')).toBeNull()
  })

  it('renders and sanitises Mermaid SVG synchronously', () => {
    const rendered = renderMermaid('flowchart LR\n  A --> B')
    expect(rendered.error).toBeUndefined()
    expect(rendered.svg).toContain('<svg')
    expect(sanitiseMermaidSvg('<svg><script>alert(1)</script><rect onclick="alert(1)" /></svg>')).not.toMatch(/script|onclick/)
  })

  it('renders inline Markdown inside table cells like Writer', () => {
    expect(parseTableCellInlineMarkdown('**bold** and `code`')).toEqual([
      { type: 'element', tag: 'strong', children: [{ type: 'text', value: 'bold' }] },
      { type: 'text', value: ' and ' },
      { type: 'element', tag: 'code', className: 'cm-inline-code', children: [{ type: 'text', value: 'code' }] },
    ])
    expect(parseTableCellInlineMarkdown('[[Other note\\|Wiki label]]')).toEqual([
      {
        type: 'element',
        tag: 'span',
        className: 'cm-wiki-link',
        wikiTarget: 'Other note\\|Wiki label',
        children: [{ type: 'text', value: 'Wiki label' }],
      },
    ])
  })

  it('extracts stable, duplicate-aware headings while ignoring fenced code', () => {
    expect(extractMarkdownHeadings('# Hello, world!\n\n```md\n# ignored\n```\n\nHello, world!\n---')).toEqual([
      { level: 1, text: 'Hello, world!', anchor: 'hello-world', position: 0 },
      { level: 2, text: 'Hello, world!', anchor: 'hello-world-1', position: 38 },
    ])
  })

  it('resolves relative, same-document, and external Markdown links', () => {
    expect(resolveMarkdownLink('/notes/project/current.md', '../guide.md#Setup')).toEqual({ kind: 'document', path: '/notes/guide.md', anchor: 'Setup' })
    expect(resolveMarkdownLink('/notes/current.md', '#details')).toEqual({ kind: 'document', path: '/notes/current.md', anchor: 'details' })
    expect(resolveMarkdownLink('/notes/current.md', 'https://example.com')).toEqual({ kind: 'external', url: 'https://example.com' })
  })

  it('uses ProseMark formatting commands for selected inline text', () => {
    const editor = createView('selected text')

    expect(executeMarkdownCommand(editor, 'bold')).toBe(true)
    expect(editor.state.doc.toString()).toBe('**selected text**')
  })

  it('inserts Kea-specific Markdown blocks without replacing editor state', () => {
    const editor = createView('', 0, 0)

    expect(executeMarkdownCommand(editor, 'insert-mermaid')).toBe(true)
    expect(editor.state.doc.toString()).toContain('```mermaid')
    expect(editor.state.doc.toString()).toContain('flowchart LR')
  })
})
