import { syntaxTree } from '@codemirror/language'
import type { EditorState, Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view'
import type { SyntaxNodeRef } from '@lezer/common'
import { foldableSyntaxFacet } from '@prosemark/core'
import { mountMermaidCanvas, MERMAID_CANVAS_HEIGHT, type MermaidCanvasHandle } from './mermaidCanvas'
import { openMermaidFullscreen } from './mermaidFullscreen'
import { renderMermaid } from './mermaidRenderer'
import './mermaid.css'

const widgets = new WeakMap<HTMLElement, MermaidCanvasHandle>()

function parseFence(state: EditorState, node: SyntaxNodeRef): { info: string; body: string } {
  let info = ''
  let body = ''
  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'CodeInfo') info = state.doc.sliceString(child.from, child.to)
    if (child.name === 'CodeText') body += state.doc.sliceString(child.from, child.to)
  }
  return { info: info.trim().toLowerCase(), body: body.trim() }
}

function replaceFence(view: EditorView, host: HTMLElement, source: string): void {
  const position = view.posAtDOM(host)
  const tree = syntaxTree(view.state)
  for (const side of [-1, 1] as const) {
    let node = tree.resolveInner(position, side)
    while (node.name !== 'FencedCode' && node.parent) node = node.parent
    if (node.name !== 'FencedCode') continue
    if (view.state.doc.sliceString(node.from, node.to) === source) return
    view.dispatch({ changes: { from: node.from, to: node.to, insert: source }, userEvent: 'input.mermaid' })
    return
  }
}

class MermaidWidget extends WidgetType {
  constructor(readonly body: string, readonly fence: string) { super() }

  eq(other: MermaidWidget): boolean {
    return this.body === other.body && this.fence === other.fence
  }

  get estimatedHeight(): number {
    return MERMAID_CANVAS_HEIGHT + 16
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-mermaid-widget'
    wrapper.contentEditable = 'false'
    const host = document.createElement('div')
    host.className = 'cm-mermaid-canvas'
    host.dataset.mermaidSource = this.body
    wrapper.append(host)

    const ariaLabel = `Mermaid diagram: ${this.body.split('\n')[0]}`
    const rendered = renderMermaid(this.body)
    const handle = mountMermaidCanvas(host, {
      svg: rendered.svg ?? '',
      ariaLabel,
      source: this.fence,
      onSourceChange: source => replaceFence(view, host, source),
      onExpand: () => openMermaidFullscreen(host.dataset.mermaidSource ?? this.body, ariaLabel),
    })
    if (rendered.error) handle.update('', this.fence, rendered.error)
    widgets.set(wrapper, handle)
    return wrapper
  }

  updateDOM(dom: HTMLElement): boolean {
    const handle = widgets.get(dom)
    if (!handle) return false
    const host = dom.querySelector<HTMLElement>('.cm-mermaid-canvas')
    if (host) host.dataset.mermaidSource = this.body
    const rendered = renderMermaid(this.body)
    handle.update(rendered.svg ?? '', this.fence, rendered.error)
    return true
  }

  destroy(dom: HTMLElement): void {
    widgets.get(dom)?.destroy()
    widgets.delete(dom)
  }

  ignoreEvent(): boolean {
    return true
  }
}

const treeSync = ViewPlugin.fromClass(class {
  update(update: ViewUpdate): void {
    if (update.docChanged || syntaxTree(update.state) === syntaxTree(update.startState)) return
    window.setTimeout(() => update.view.dispatch({ selection: update.view.state.selection }))
  }
})

export function mermaidExtension(): Extension {
  return [
    foldableSyntaxFacet.of({
      nodePath: 'FencedCode',
      keepDecorationOnUnfold: true,
      buildDecorations(state, node) {
        const parsed = parseFence(state, node)
        if (!parsed.info.startsWith('mermaid') || !parsed.body) return undefined
        const fence = state.doc.sliceString(node.from, node.to)
        return Decoration.replace({
          widget: new MermaidWidget(parsed.body, fence),
          block: true,
          inclusiveStart: true,
        }).range(node.from, node.to)
      },
    }),
    treeSync,
  ]
}
