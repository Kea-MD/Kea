import type { InlineContext, MarkdownConfig } from '@lezer/markdown'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

function closingBracket(cx: InlineContext, pos: number, double = false): number {
  for (let cursor = pos; cursor < cx.end; cursor += 1) {
    if (cx.char(cursor) === 92) { cursor += 1; continue }
    if (cx.char(cursor) === 93 && (!double || cx.char(cursor + 1) === 93)) return cursor + (double ? 2 : 1)
  }
  return -1
}

const highlightDelimiter = { resolve: 'Highlight', mark: 'HighlightMark' }

export const markdownCompatibilitySyntax: MarkdownConfig = {
  defineNodes: ['FootnoteReference', 'CalloutMarker', 'WikiLink', 'Highlight', 'HighlightMark'],
  parseInline: [
    {
      name: 'KeaBracketSyntax',
      before: 'Link',
      parse(cx, next, pos) {
        if (next !== 91) return -1
        if (cx.char(pos + 1) === 91) {
          const end = closingBracket(cx, pos + 2, true)
          return end < 0 ? -1 : cx.addElement(cx.elt('WikiLink', pos, end))
        }
        if (cx.char(pos + 1) === 94) {
          const end = closingBracket(cx, pos + 2)
          return end < 0 ? -1 : cx.addElement(cx.elt('FootnoteReference', pos, end))
        }
        if (cx.char(pos + 1) === 33) {
          const end = closingBracket(cx, pos + 2)
          return end < 0 ? -1 : cx.addElement(cx.elt('CalloutMarker', pos, end))
        }
        return -1
      },
    },
    {
      name: 'KeaHighlight',
      after: 'Emphasis',
      parse(cx, next, pos) {
        if (next !== 61 || cx.char(pos + 1) !== 61 || cx.char(pos + 2) === 61) return -1
        const before = cx.slice(pos - 1, pos)
        const after = cx.slice(pos + 2, pos + 3)
        return cx.addDelimiter(highlightDelimiter, pos, pos + 2, !/^\s|$/.test(after), !/\s$|^$/.test(before))
      },
    },
  ],
}

function compatibilityDecorations(view: EditorView): DecorationSet {
  const decorations: Array<ReturnType<Decoration['range']>> = []
  const seen = new Set<string>()
  const add = (from: number, to: number, className: string): void => {
    const key = `${from}:${to}:${className}`
    if (from >= to || seen.has(key)) return
    seen.add(key)
    decorations.push(Decoration.mark({ class: className }).range(from, to))
  }

  for (const visible of view.visibleRanges) {
    const from = view.state.doc.lineAt(visible.from).from
    const to = view.state.doc.lineAt(visible.to).to
    const text = view.state.doc.sliceString(from, to)
    for (const match of text.matchAll(/==([^=\n](?:.*?[^=])?)==/g)) add(from + (match.index ?? 0) + 2, from + (match.index ?? 0) + match[0].length - 2, 'cm-kea-highlight')
    for (const match of text.matchAll(/\[\^[^\]\n]+\]/g)) add(from + (match.index ?? 0), from + (match.index ?? 0) + match[0].length, 'cm-kea-footnote-ref')
    for (const match of text.matchAll(/\[\[[^\]\n]+\]\]/g)) add(from + (match.index ?? 0), from + (match.index ?? 0) + match[0].length, 'cm-kea-wiki-link')
    for (const match of text.matchAll(/^\s*>\s*\[![A-Za-z]+\].*$/gm)) add(from + (match.index ?? 0), from + (match.index ?? 0) + match[0].length, 'cm-kea-callout')
    for (const match of text.matchAll(/^\[\^[^\]\n]+\]:.*$/gm)) add(from + (match.index ?? 0), from + (match.index ?? 0) + match[0].length, 'cm-kea-footnote-definition')
  }
  return Decoration.set(decorations, true)
}

const compatibilityPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet
  constructor(view: EditorView) { this.decorations = compatibilityDecorations(view) }
  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged) this.decorations = compatibilityDecorations(update.view)
  }
}, { decorations: plugin => plugin.decorations })

const compatibilityTheme = EditorView.baseTheme({
  '.cm-kea-highlight': { backgroundColor: 'rgba(244, 198, 72, .3)', borderRadius: '3px' },
  '.cm-kea-footnote-ref': { color: 'rgb(var(--react-brand-rgb))', cursor: 'pointer', fontSize: '.78em', verticalAlign: 'super' },
  '.cm-kea-footnote-definition': { color: 'var(--react-dark-600)' },
  '.cm-kea-wiki-link': { color: 'rgb(var(--react-brand-rgb))', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' },
  '.cm-kea-callout': { backgroundColor: 'rgba(var(--react-brand-rgb), .09)', borderLeft: '3px solid rgb(var(--react-brand-rgb))' },
})

export function markdownCompatibilityExtension(onWikiLink: (url: string) => void): Extension {
  return [
    compatibilityPlugin,
    compatibilityTheme,
    EditorView.domEventHandlers({
      mousedown(event, view) {
        const target = event.target instanceof Element ? event.target : null
        if (target?.classList.contains('cm-kea-footnote-ref')) {
          const pos = view.posAtCoords(event)
          if (pos === null) return false
          const line = view.state.doc.lineAt(pos)
          const match = view.state.doc.sliceString(line.from, line.to).match(/\[\^([^\]]+)\]/)
          if (!match) return false
          const definition = view.state.doc.toString().match(new RegExp(`^\\[\\^${match[1]?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]:`, 'm'))
          if (definition?.index !== undefined) view.dispatch({ selection: { anchor: definition.index }, effects: EditorView.scrollIntoView(definition.index, { y: 'center' }) })
          event.preventDefault()
          return true
        }
        if (target?.classList.contains('cm-kea-wiki-link')) {
          const text = target.textContent?.replace(/^\[\[|\]\]$/g, '').split('|')[0]?.trim()
          if (!text) return false
          event.preventDefault()
          onWikiLink(text.includes('.') ? text : `${text}.md`)
          return true
        }
        return false
      },
    }),
  ]
}
