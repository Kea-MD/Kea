import { syntaxTree } from '@codemirror/language'
import { Prec, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export interface MarkdownLinkTarget {
  kind: 'external' | 'document'
  url?: string
  path?: string
  anchor?: string
}

function directoryOf(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index < 0 ? '' : path.slice(0, index)
}

function normalisePath(path: string): string {
  const prefix = path.startsWith('/') ? '/' : ''
  const parts: string[] = []
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return prefix + parts.join('/')
}

export function resolveMarkdownLink(documentPath: string, rawUrl: string): MarkdownLinkTarget | null {
  const url = rawUrl.trim().replace(/^<|>$/g, '')
  if (!url) return null
  if (/^(?:https?:|mailto:|tel:)/i.test(url)) return { kind: 'external', url }
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return null

  const [rawPath, rawAnchor] = url.split('#', 2)
  let decodedPath = rawPath?.split('?')[0] ?? ''
  let anchor = rawAnchor ?? ''
  try { decodedPath = decodeURIComponent(decodedPath); anchor = decodeURIComponent(anchor) } catch { /* Keep malformed escapes literal. */ }
  const path = decodedPath
    ? normalisePath(decodedPath.startsWith('/') ? decodedPath : `${directoryOf(documentPath)}/${decodedPath}`)
    : documentPath
  if (!path) return null
  return { kind: 'document', path, anchor }
}

function wikiLinkUrl(rawTarget: string): string {
  const separator = rawTarget.indexOf('|')
  const targetEnd = separator < 0 ? rawTarget.length : rawTarget[separator - 1] === '\\' ? separator - 1 : separator
  const target = rawTarget.slice(0, targetEnd).replace(/\\\|/g, '|').trim()
  if (!target) return ''
  return target.includes('.') || target.includes('#') ? target : `${target}.md`
}

function urlAt(view: EditorView, pos: number): string | null {
  let url: string | null = null
  syntaxTree(view.state).iterate({
    from: pos,
    to: pos,
    enter(node) {
      if (node.name !== 'URL') return
      url = view.state.doc.sliceString(node.from, node.to)
      return false
    },
  })
  return url
}

export function internalLinkExtension(onOpenLink: (url: string) => void): Extension {
  return Prec.highest(EditorView.domEventHandlers({
    mousedown(event, view) {
      const element = event.target instanceof Element ? event.target.closest('.cm-rendered-link, .cm-url, .cm-wiki-link') : null
      if (!element) return false
      if (element instanceof HTMLElement && element.dataset.wikiTarget) {
        const target = wikiLinkUrl(element.dataset.wikiTarget)
        if (!target) return false
        event.preventDefault()
        onOpenLink(target.includes('.') || target.includes('#') ? target : `${target}.md`)
        return true
      }
      if (element instanceof HTMLElement && element.dataset.href) {
        event.preventDefault()
        onOpenLink(element.dataset.href)
        return true
      }
      const pos = view.posAtCoords(event)
      if (pos === null) return false
      const url = urlAt(view, pos)
      if (!url) return false
      event.preventDefault()
      onOpenLink(url)
      return true
    },
  }))
}
