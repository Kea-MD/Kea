import { syntaxTree } from '@codemirror/language'
import type { EditorState, Extension, Range } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view'
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { GFM, parser as markdownParser } from '@lezer/markdown'
import * as emoji from 'node-emoji'
import {
  foldableSyntaxFacet,
  prosemarkMarkdownSyntaxExtensions,
  selectAllDecorationsOnSelectExtension,
} from '@prosemark/core'
import { markdownCompatibilitySyntax } from './markdownCompatibility'

type TableAlignment = 'left' | 'center' | 'right'

export interface MarkdownTable {
  headers: string[]
  alignments: Array<TableAlignment | undefined>
  rows: string[][]
}

type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'break' }
  | {
      type: 'element'
      tag: 'strong' | 'em' | 'code' | 's' | 'span'
      className?: string
      href?: string
      wikiTarget?: string
      children: InlineNode[]
    }

const inlineParser = markdownParser.configure([GFM, prosemarkMarkdownSyntaxExtensions, markdownCompatibilitySyntax])
const hiddenMarks = new Set(['CodeMark', 'EmphasisMark', 'EscapeMark', 'LinkMark', 'StrikethroughMark', 'HighlightMark'])
const hiddenLinkParts = new Set([...hiddenMarks, 'LinkLabel', 'LinkTitle', 'URL'])

function isEscaped(text: string, index: number): boolean {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashes += 1
  return slashes % 2 === 1
}

function splitCells(line: string): string[] {
  const value = line.trim()
  const start = value.startsWith('|') ? 1 : 0
  const end = value.endsWith('|') && !isEscaped(value, value.length - 1) ? value.length - 1 : value.length
  const cells: string[] = []
  let cell = ''
  let escaped = false
  for (let index = start; index < end; index += 1) {
    const character = value[index] ?? ''
    if (character === '|' && !escaped) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += character
    }
    escaped = character === '\\' && !escaped
  }
  cells.push(cell.trim())
  return cells
}

function alignment(value: string): TableAlignment | undefined {
  const left = value.startsWith(':')
  const right = value.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return undefined
}

export function parseMarkdownTable(source: string): MarkdownTable | null {
  const lines = source.split('\n').filter(line => line.trim())
  if (lines.length < 2) return null
  const headers = splitCells(lines[0] ?? '')
  const delimiters = splitCells(lines[1] ?? '')
  if (headers.length === 0 || delimiters.length !== headers.length) return null
  if (!delimiters.every(cell => /^:?-+:?$/.test(cell))) return null
  return {
    headers,
    alignments: delimiters.map(alignment),
    rows: lines.slice(2).map(line => splitCells(line)),
  }
}

function addText(nodes: InlineNode[], value: string): void {
  if (!value) return
  const last = nodes[nodes.length - 1]
  if (last?.type === 'text') last.value += value
  else nodes.push({ type: 'text', value })
}

function addNodes(nodes: InlineNode[], additions: InlineNode[]): void {
  for (const addition of additions) {
    if (addition.type === 'text') addText(nodes, addition.value)
    else nodes.push(addition)
  }
}

function children(markdown: string, node: SyntaxNode, hidden = hiddenMarks): InlineNode[] {
  const output: InlineNode[] = []
  let position = node.from
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from > position) addText(output, markdown.slice(position, child.from))
    if (!hidden.has(child.name)) addNodes(output, renderNode(markdown, child))
    position = child.to
  }
  if (position < node.to) addText(output, markdown.slice(position, node.to))
  return output
}

function element(
  tag: Extract<InlineNode, { type: 'element' }>['tag'],
  childNodes: InlineNode[],
  properties: Pick<Extract<InlineNode, { type: 'element' }>, 'className' | 'href' | 'wikiTarget'> = {},
): InlineNode[] {
  return [{ type: 'element', tag, children: childNodes, ...properties }]
}

function decodeEntity(value: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

function wikiLinkDisplay(raw: string): string {
  const separator = raw.indexOf('|')
  if (separator < 0) return raw.replace(/\\\|/g, '|').trim()
  return raw.slice(separator + 1).replace(/\\\|/g, '|').trim()
    || raw.slice(0, raw[separator - 1] === '\\' ? separator - 1 : separator).replace(/\\\|/g, '|').trim()
}

function renderNode(markdown: string, node: SyntaxNode): InlineNode[] {
  switch (node.name) {
    case 'Document': case 'Paragraph': return children(markdown, node)
    case 'StrongEmphasis': return element('strong', children(markdown, node))
    case 'Emphasis': return element('em', children(markdown, node))
    case 'Strikethrough': return element('s', children(markdown, node))
    case 'InlineCode': return element('code', children(markdown, node), { className: 'cm-inline-code' })
    case 'Highlight': return element('span', children(markdown, node), { className: 'cm-kea-highlight' })
    case 'Link': case 'Autolink': {
      const urlNode = node.getChild('URL')
      const href = urlNode ? markdown.slice(urlNode.from, urlNode.to).trim() : undefined
      const label = children(markdown, node, hiddenLinkParts)
      if (!label.length && href) addText(label, href)
      return element('span', label, { className: 'cm-rendered-link', href })
    }
    case 'WikiLink': {
      const target = markdown.slice(node.from + 2, node.to - 2)
      return element('span', [{ type: 'text', value: wikiLinkDisplay(target) }], { className: 'cm-wiki-link', wikiTarget: target })
    }
    case 'URL': {
      const href = markdown.slice(node.from, node.to)
      return element('span', [{ type: 'text', value: href }], { className: 'cm-rendered-link', href })
    }
    case 'Image': {
      const label = children(markdown, node, hiddenLinkParts)
      return label.length ? label : [{ type: 'text', value: markdown.slice(node.from, node.to) }]
    }
    case 'Escape': return [{ type: 'text', value: markdown.slice(node.from + 1, node.to) }]
    case 'Entity': return [{ type: 'text', value: decodeEntity(markdown.slice(node.from, node.to)) }]
    case 'HardBreak': return [{ type: 'break' }]
    case 'Dash': {
      const length = node.to - node.from
      return [{ type: 'text', value: length === 2 ? '–' : length === 3 ? '—' : markdown.slice(node.from, node.to) }]
    }
    case 'Emoji': {
      const name = markdown.slice(node.from + 1, node.to - 1)
      return [{ type: 'text', value: emoji.get(name) || markdown.slice(node.from, node.to) }]
    }
    default: return node.firstChild ? children(markdown, node) : [{ type: 'text', value: markdown.slice(node.from, node.to) }]
  }
}

export function parseTableCellInlineMarkdown(markdown: string): InlineNode[] {
  return renderNode(markdown, inlineParser.parse(markdown).topNode)
}

function appendInline(parent: HTMLElement, nodes: InlineNode[]): void {
  for (const node of nodes) {
    if (node.type === 'text') { parent.append(document.createTextNode(node.value)); continue }
    if (node.type === 'break') { parent.append(document.createElement('br')); continue }
    const child = document.createElement(node.tag)
    if (node.className) child.className = node.className
    if (node.href) child.dataset.href = node.href
    if (node.wikiTarget) child.dataset.wikiTarget = node.wikiTarget
    appendInline(child, node.children)
    parent.append(child)
  }
}

function setCellContent(cell: HTMLElement, markdown: string): void {
  cell.replaceChildren()
  appendInline(cell, parseTableCellInlineMarkdown(markdown))
}

function estimatedHeight(table: MarkdownTable): number {
  return Math.ceil(8 + (1 + table.rows.length) * 38.4 + (2 + table.rows.length))
}

function sourceLineDecorations(state: EditorState, node: SyntaxNodeRef): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = []
  const first = state.doc.lineAt(node.from)
  for (let position = first.from; position <= node.to;) {
    const line = state.doc.lineAt(position)
    const firstLine = line.from === first.from
    const lastLine = line.to >= node.to
    const classes = ['cm-table-source-line']
    if (firstLine) classes.push('cm-table-source-line-first')
    if (lastLine) classes.push('cm-table-source-line-last')
    decorations.push(Decoration.line({ class: classes.join(' ') }).range(line.from))
    if (lastLine) break
    position = line.to + 1
  }
  return decorations
}

class TableWidget extends WidgetType {
  constructor(readonly table: MarkdownTable, readonly source: string) { super() }

  eq(other: TableWidget): boolean { return this.source === other.source }
  ignoreEvent(): boolean { return false }
  get estimatedHeight(): number { return estimatedHeight(this.table) }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-table-widget'
    const inner = document.createElement('div')
    inner.className = 'cm-table-inner'
    const table = document.createElement('table')
    const headerRow = table.createTHead().insertRow()
    this.table.headers.forEach((header, index) => {
      const cell = document.createElement('th')
      setCellContent(cell, header)
      if (this.table.alignments[index]) cell.style.textAlign = this.table.alignments[index]
      headerRow.append(cell)
    })
    const body = table.createTBody()
    this.table.rows.forEach(row => {
      const tableRow = body.insertRow()
      this.table.headers.forEach((_, index) => {
        const cell = tableRow.insertCell()
        setCellContent(cell, row[index] ?? '')
        if (this.table.alignments[index]) cell.style.textAlign = this.table.alignments[index]
      })
    })
    inner.append(table)
    wrapper.append(inner)
    return wrapper
  }

  updateDOM(dom: HTMLElement): boolean {
    const headers = dom.querySelectorAll<HTMLElement>('thead th')
    const rows = dom.querySelectorAll<HTMLTableRowElement>('tbody tr')
    if (headers.length !== this.table.headers.length || rows.length !== this.table.rows.length) return false
    headers.forEach((cell, index) => {
      setCellContent(cell, this.table.headers[index] ?? '')
      cell.style.textAlign = this.table.alignments[index] ?? ''
    })
    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll<HTMLElement>('td')
      if (cells.length !== this.table.headers.length) return
      cells.forEach((cell, columnIndex) => {
        setCellContent(cell, this.table.rows[rowIndex]?.[columnIndex] ?? '')
        cell.style.textAlign = this.table.alignments[columnIndex] ?? ''
      })
    })
    return true
  }
}

const tableTheme = EditorView.baseTheme({
  '.cm-table-widget': { padding: '.25em 0' },
  '.cm-table-inner': { display: 'inline-block' },
  '.cm-table-widget table': {
    width: 'auto',
    overflow: 'hidden',
    border: '1px solid var(--border-color, #3e3e42)',
    borderCollapse: 'separate',
    borderSpacing: '0',
    borderRadius: '8px',
    fontFamily: 'inherit',
    fontSize: 'inherit',
  },
  '.cm-table-widget th, .cm-table-widget td': {
    minWidth: '6em',
    padding: '.5em .8em',
    borderRight: '1px solid var(--border-color, #3e3e42)',
    borderBottom: '1px solid var(--border-color, #3e3e42)',
    fontSize: 'inherit',
    lineHeight: '1.4',
  },
  '.cm-table-widget th:last-child, .cm-table-widget td:last-child': { borderRight: 'none' },
  '.cm-table-widget tbody tr:last-child td': { borderBottom: 'none' },
  '.cm-table-widget th': { backgroundColor: 'var(--surface-subtle, var(--pm-code-background-color))', fontWeight: '600' },
  '.cm-table-source-line': {
    display: 'block',
    marginLeft: '0',
    paddingLeft: '12px',
    paddingRight: '12px',
    backgroundColor: 'var(--pm-code-background-color)',
    fontFamily: 'var(--pm-code-font, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
    fontVariantLigatures: 'none',
    fontFeatureSettings: '"calt" 0',
    fontKerning: 'none',
  },
  '.cm-activeLine.cm-table-source-line': { backgroundColor: 'var(--pm-code-background-color)' },
  '.cm-table-source-line-first': { borderTopLeftRadius: '.4rem', borderTopRightRadius: '.4rem' },
  '.cm-table-source-line-last': { borderBottomLeftRadius: '.4rem', borderBottomRightRadius: '.4rem' },
})

const treeSync = ViewPlugin.fromClass(class {
  update(update: ViewUpdate): void {
    if (update.docChanged || syntaxTree(update.state) === syntaxTree(update.startState)) return
    window.setTimeout(() => update.view.dispatch({ selection: update.view.state.selection }))
  }
})

export function tableExtension(): Extension {
  return [
    foldableSyntaxFacet.of({
      nodePath: 'Table',
      keepDecorationOnUnfold: true,
      buildDecorations(state, node, selectionTouchesRange) {
        const source = state.doc.sliceString(node.from, node.to)
        const table = parseMarkdownTable(source)
        if (!table) return undefined
        if (selectionTouchesRange) return sourceLineDecorations(state, node)
        return Decoration.replace({
          widget: new TableWidget(table, source),
          block: true,
          inclusiveStart: true,
        }).range(node.from, node.to)
      },
    }),
    tableTheme,
    treeSync,
    selectAllDecorationsOnSelectExtension('cm-table-widget'),
  ]
}
