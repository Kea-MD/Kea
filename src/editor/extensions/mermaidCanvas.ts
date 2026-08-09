import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { StreamLanguage } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { drawSelection, EditorView, keymap } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { baseSyntaxHighlights, generalSyntaxHighlights } from '@prosemark/core'
import { sanitiseMermaidSvg } from './mermaidRenderer'

export const MERMAID_CANVAS_HEIGHT = 480

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const FIT_MARGIN = 16
const BUTTON_ZOOM = 1.2
const KEYBOARD_ZOOM = 1.15
const PAN_STEP = 24
const SOURCE_DEBOUNCE_MS = 150
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

interface MermaidCanvasOptions {
  svg: string
  ariaLabel: string
  source?: string
  onSourceChange?: (source: string) => void
  onExpand?: () => void
  onClose?: () => void
}

export interface MermaidCanvasHandle {
  update(svg: string, source: string, error?: string): void
  destroy(): void
}

interface CanvasTransform {
  zoom: number
  x: number
  y: number
}

function button(label: string, ariaLabel: string): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  element.title = ariaLabel
  element.setAttribute('aria-label', ariaLabel)
  element.addEventListener('mousedown', event => {
    event.preventDefault()
    event.stopPropagation()
  })
  return element
}

function iconButton(ariaLabel: string, paths: string[]): HTMLButtonElement {
  const element = button('', ariaLabel)
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
  svg.setAttribute('class', 'cm-mermaid-canvas-button-icon')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  for (const pathData of paths) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path')
    path.setAttribute('d', pathData)
    svg.append(path)
  }
  element.replaceChildren(svg)
  return element
}

function decorateSvg(svg: SVGSVGElement | null, ariaLabel: string): void {
  if (!svg) return
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', ariaLabel)
}

export function mountMermaidCanvas(host: HTMLElement, options: MermaidCanvasOptions): MermaidCanvasHandle {
  host.replaceChildren()
  host.classList.add('cm-mermaid-canvas')
  host.tabIndex = 0

  const sourceEditingEnabled = options.source !== undefined && options.onSourceChange !== undefined
  const sourcePanel = document.createElement('div')
  sourcePanel.className = 'cm-mermaid-canvas-editor'
  const viewport = document.createElement('div')
  viewport.className = 'cm-mermaid-canvas-viewport'
  const stage = document.createElement('div')
  stage.className = 'cm-mermaid-canvas-stage'
  stage.innerHTML = sanitiseMermaidSvg(options.svg)
  stage.style.opacity = '0'
  viewport.append(stage)
  if (sourceEditingEnabled) host.append(sourcePanel)
  host.append(viewport)

  let svg = stage.querySelector<SVGSVGElement>('svg')
  decorateSvg(svg, options.ariaLabel)
  let naturalWidth = 0
  let naturalHeight = 0
  const transform: CanvasTransform = { zoom: 1, x: 0, y: 0 }

  const measureDiagram = (): void => {
    if (!svg || naturalWidth > 0) return
    const viewBox = svg.viewBox?.baseVal
    if (viewBox?.width && viewBox.height) {
      naturalWidth = viewBox.width
      naturalHeight = viewBox.height
      return
    }
    const bounds = svg.getBoundingClientRect()
    naturalWidth = bounds.width
    naturalHeight = bounds.height
  }

  const applyTransform = (): void => {
    if (svg && naturalWidth > 0) {
      svg.style.width = `${naturalWidth * transform.zoom}px`
      svg.style.height = `${naturalHeight * transform.zoom}px`
    }
    stage.style.transform = `translate(${transform.x}px, ${transform.y}px)`
  }

  const clampZoom = (zoom: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))

  const fit = (): void => {
    measureDiagram()
    if (naturalWidth <= 0 || naturalHeight <= 0 || viewport.clientWidth <= 0 || viewport.clientHeight <= 0) {
      applyTransform()
      return
    }
    transform.zoom = clampZoom(Math.min(
      (viewport.clientWidth - FIT_MARGIN * 2) / naturalWidth,
      (viewport.clientHeight - FIT_MARGIN * 2) / naturalHeight,
    ))
    transform.x = (viewport.clientWidth - naturalWidth * transform.zoom) / 2
    transform.y = (viewport.clientHeight - naturalHeight * transform.zoom) / 2
    applyTransform()
  }

  const zoomAt = (clientX: number, clientY: number, factor: number): void => {
    measureDiagram()
    const bounds = viewport.getBoundingClientRect()
    const localX = clientX - bounds.left
    const localY = clientY - bounds.top
    const sourceX = (localX - transform.x) / transform.zoom
    const sourceY = (localY - transform.y) / transform.zoom
    const nextZoom = clampZoom(transform.zoom * factor)
    if (nextZoom === transform.zoom) return
    transform.zoom = nextZoom
    transform.x = localX - sourceX * nextZoom
    transform.y = localY - sourceY * nextZoom
    applyTransform()
  }

  const zoomAtCentre = (factor: number): void => {
    const bounds = viewport.getBoundingClientRect()
    zoomAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, factor)
  }

  const topControls = document.createElement('div')
  topControls.className = 'cm-mermaid-canvas-top'
  const zoomControls = document.createElement('div')
  zoomControls.className = 'cm-mermaid-canvas-zoom'

  let editing = false
  let sourceEditor: EditorView | null = null
  let currentSource = options.source ?? ''
  let sourceTimer: number | null = null
  let editButton: HTMLButtonElement | null = null

  const flushSource = (): void => {
    sourceTimer = null
    if (!sourceEditor || !options.onSourceChange) return
    const next = sourceEditor.state.doc.toString()
    if (next === currentSource) return
    currentSource = next
    options.onSourceChange(next)
  }

  const scheduleSource = (): void => {
    if (sourceTimer !== null) window.clearTimeout(sourceTimer)
    sourceTimer = window.setTimeout(flushSource, SOURCE_DEBOUNCE_MS)
  }

  const updateEditButton = (): void => {
    if (!editButton) return
    const label = editing ? 'Preview' : 'Edit code'
    editButton.title = label
    editButton.setAttribute('aria-label', label)
    editButton.setAttribute('aria-pressed', String(editing))
    editButton.classList.toggle('is-active', editing)
  }

  const setEditing = (next: boolean): void => {
    if (editing === next) return
    editing = next
    host.classList.toggle('is-editing', editing)
    if (editing && !sourceEditor) sourceEditor = createSourceEditor(sourcePanel, currentSource, scheduleSource)
    updateEditButton()
    requestAnimationFrame(fit)
    if (editing) sourceEditor?.focus()
    else host.focus()
  }

  if (sourceEditingEnabled) {
    editButton = iconButton('Edit code', ['m16 18 6-6-6-6', 'm8 6-6 6 6 6', 'm13 4-2 16'])
    editButton.classList.add('cm-mermaid-canvas-edit', 'cm-mermaid-canvas-icon-btn')
    editButton.addEventListener('click', () => setEditing(!editing))
    topControls.append(editButton)
    updateEditButton()
  }

  if (options.onClose) {
    const close = button('✕', 'Close fullscreen')
    close.classList.add('cm-mermaid-canvas-icon-btn')
    close.addEventListener('click', options.onClose)
    topControls.append(close)
  }

  if (options.onExpand) {
    const expand = button('⛶', 'Open in fullscreen')
    expand.classList.add('cm-mermaid-canvas-zoom-btn')
    expand.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      host.focus()
      options.onExpand?.()
    })
    zoomControls.append(expand)
  }

  const reset = iconButton('Reset zoom and pan', ['M3 12a9 9 0 1 0 2.64-6.36L3 8', 'M3 3v5h5'])
  const zoomIn = button('+', 'Zoom in')
  const zoomOut = button('−', 'Zoom out')
  for (const control of [reset, zoomIn, zoomOut]) control.classList.add('cm-mermaid-canvas-zoom-btn')
  reset.addEventListener('click', () => { fit(); host.focus() })
  zoomIn.addEventListener('click', () => { zoomAtCentre(BUTTON_ZOOM); host.focus() })
  zoomOut.addEventListener('click', () => { zoomAtCentre(1 / BUTTON_ZOOM); host.focus() })
  zoomControls.append(reset, zoomIn, zoomOut)
  host.append(topControls, zoomControls)

  let pointerId: number | null = null
  let pointerX = 0
  let pointerY = 0
  let startX = 0
  let startY = 0
  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    pointerId = event.pointerId
    pointerX = event.clientX
    pointerY = event.clientY
    startX = transform.x
    startY = transform.y
    viewport.setPointerCapture(event.pointerId)
    viewport.classList.add('is-dragging')
    host.focus()
    event.preventDefault()
  })
  viewport.addEventListener('pointermove', event => {
    if (pointerId !== event.pointerId) return
    transform.x = startX + event.clientX - pointerX
    transform.y = startY + event.clientY - pointerY
    applyTransform()
  })
  const finishPan = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return
    pointerId = null
    viewport.classList.remove('is-dragging')
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
  }
  viewport.addEventListener('pointerup', finishPan)
  viewport.addEventListener('pointercancel', finishPan)
  viewport.addEventListener('wheel', event => {
    if (!event.metaKey && !event.ctrlKey) return
    event.preventDefault()
    const sensitivity = event.ctrlKey && !event.metaKey ? 0.01 : 0.0015
    zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * sensitivity))
  }, { passive: false })

  host.addEventListener('keydown', event => {
    if (editing && sourcePanel.contains(event.target as Node)) return
    if (event.target instanceof HTMLButtonElement) return
    let handled = true
    switch (event.key) {
      case 'ArrowUp': transform.y += PAN_STEP; applyTransform(); break
      case 'ArrowDown': transform.y -= PAN_STEP; applyTransform(); break
      case 'ArrowLeft': transform.x += PAN_STEP; applyTransform(); break
      case 'ArrowRight': transform.x -= PAN_STEP; applyTransform(); break
      case '+': case '=': zoomAtCentre(KEYBOARD_ZOOM); break
      case '-': case '_': zoomAtCentre(1 / KEYBOARD_ZOOM); break
      case '0': fit(); break
      case 'Enter': if (sourceEditingEnabled) setEditing(!editing); else handled = false; break
      default: handled = false
    }
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  })

  const showError = (message: string): void => {
    stage.replaceChildren()
    stage.style.cssText = 'position:absolute;inset:0;opacity:1;transform:none'
    const error = document.createElement('div')
    error.className = 'cm-mermaid-canvas-error-msg'
    error.textContent = `Diagram error: ${message}`
    stage.append(error)
    svg = null
    naturalWidth = 0
    naturalHeight = 0
  }

  requestAnimationFrame(() => { fit(); stage.style.opacity = '1' })

  return {
    update(nextSvg, nextSource, error) {
      if (sourceEditor && sourceEditor.state.doc.toString() !== nextSource) {
        if (sourceTimer !== null) window.clearTimeout(sourceTimer)
        sourceTimer = null
        sourceEditor.dispatch({ changes: { from: 0, to: sourceEditor.state.doc.length, insert: nextSource } })
      }
      currentSource = nextSource
      if (error) {
        showError(error)
        return
      }
      stage.style.cssText = 'position:absolute;top:0;left:0;transform-origin:0 0;opacity:0'
      stage.innerHTML = sanitiseMermaidSvg(nextSvg)
      svg = stage.querySelector<SVGSVGElement>('svg')
      decorateSvg(svg, options.ariaLabel)
      naturalWidth = 0
      naturalHeight = 0
      requestAnimationFrame(() => { fit(); stage.style.opacity = '1' })
    },
    destroy() {
      if (sourceTimer !== null) window.clearTimeout(sourceTimer)
      sourceEditor?.destroy()
      sourceEditor = null
    },
  }
}

const MERMAID_KEYWORDS = new Set([
  'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'stateDiagram-v2',
  'erDiagram', 'gantt', 'pie', 'journey', 'gitGraph', 'mindmap', 'timeline', 'quadrantChart',
  'requirementDiagram', 'xychart', 'xychart-beta', 'sankey', 'sankey-beta', 'block', 'block-beta',
  'TD', 'TB', 'BT', 'RL', 'LR', 'subgraph', 'end', 'direction', 'class', 'classDef', 'click',
  'style', 'linkStyle', 'participant', 'actor', 'note', 'loop', 'alt', 'else', 'opt', 'par',
  'critical', 'break', 'rect', 'over', 'autonumber', 'activate', 'deactivate', 'title',
  'dateFormat', 'axisFormat', 'section',
])

const mermaidLanguage = StreamLanguage.define<Record<string, never>>({
  name: 'mermaid',
  startState: () => ({}),
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.match('%%')) { stream.skipToEnd(); return 'comment' }
    if (stream.match(/^"[^"]*"/)) return 'string'
    if (stream.match(/^(-->|---|-\.->|-\.-|==>|==|->|<-{1,2}|o--o?|x--x?)/)) return 'operator'
    if (stream.match(/^[{}[\]()|:;,]/)) return 'punctuation'
    if (stream.match(/^\d+(?:\.\d+)?/)) return 'number'
    if (stream.match(/^[A-Za-z_][\w-]*/)) return MERMAID_KEYWORDS.has(stream.current()) ? 'keyword' : 'variableName'
    stream.next()
    return null
  },
})

function createSourceEditor(parent: HTMLElement, source: string, onChange: () => void): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: source,
      extensions: [
        markdown({ extensions: [GFM], codeLanguages: info => info.toLowerCase().startsWith('mermaid') ? mermaidLanguage : null }),
        baseSyntaxHighlights,
        generalSyntaxHighlights,
        drawSelection(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': { fontFamily: 'var(--pm-code-font, ui-monospace, SFMono-Regular, Menlo, monospace)' },
          '&.cm-focused': { outline: 'none' },
        }),
        EditorView.updateListener.of(update => { if (update.docChanged) onChange() }),
        EditorView.domEventHandlers({
          mousedown: event => { event.stopPropagation(); return false },
          pointerdown: event => { event.stopPropagation(); return false },
          keydown: event => { event.stopPropagation(); return false },
        }),
      ],
    }),
  })
}
