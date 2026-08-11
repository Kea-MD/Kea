import { useEffect, useRef, useState } from 'react'
import { markdown } from '@codemirror/lang-markdown'
import { redoDepth, undoDepth } from '@codemirror/commands'
import { languages } from '@codemirror/language-data'
import { forceParsing, syntaxTreeAvailable } from '@codemirror/language'
import { Compartment, EditorSelection, EditorState, Transaction } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import {
  prosemarkBaseThemeSetup,
  prosemarkBasicSetup,
  prosemarkMarkdownSyntaxExtensions,
} from '@prosemark/core'
import {
  htmlBlockExtension,
  renderHtmlMarkdownSyntaxExtensions,
} from '@prosemark/render-html'
import {
  latexMarkdownEditorExtensions,
  latexMarkdownSyntaxTheme,
} from '@prosemark/latex'
import {
  pastePlainTextExtension,
  pasteRichTextExtension,
} from '@prosemark/paste-rich-text'
import type { EditorController } from '../core/contracts/editor'
import { loadBundledMathJax } from './bundledMathJax'
import { createCodeMirrorController } from './markdownCommands'
import { localImageExtension } from './extensions/localImages'
import { mermaidExtension } from './extensions/mermaid'
import { tableExtension } from './extensions/table'
import { internalLinkExtension } from './linkNavigation'
import { imageIngestionExtension } from './extensions/imageIngestion'
import { markdownCompatibilityExtension, markdownCompatibilitySyntax } from './extensions/markdownCompatibility'
import { extractMarkdownHeadings, resolveActiveHeadingPosition } from './markdownHeadings'
import { CurvedEditorScrollbar } from './CurvedEditorScrollbar'

interface ProseMarkEditorProps {
  documentId: string
  documentPath: string
  content: string
  contentRevision: number
  onChange: (content: string) => void
  onEditorChange: (editor: EditorController | null) => void
  onEditorStateChange: () => void
  onActiveHeadingChange?: (position: number | null) => void
  onOpenLink: (url: string) => void
  topChromeHidden?: boolean
}

interface ViewportSnapshot {
  anchor: number
  head: number
  scrollTop: number
}

const viewportSnapshots = new Map<string, ViewportSnapshot>()
const CONTENT_PUBLISH_DELAY_MS = 140
const VIEWPORT_OVERSHOOT = 2000
const VIEWPORT_PARSE_SETTLE_MS = 120
const VIEWPORT_PARSE_BUDGET_MS = 8
const INITIAL_PARSE_BUDGET_MS = 50
const IDLE_PARSE_BUDGET_MS = 50
const IDLE_PARSE_TIMEOUT_MS = 2000

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function advanceViewportParse(view: EditorView, isDisposed: () => boolean): void {
  const target = Math.min(view.state.doc.length, view.viewport.to + VIEWPORT_OVERSHOOT)
  forceParsing(view, target, INITIAL_PARSE_BUDGET_MS)

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      if (!isDisposed()) forceParsing(view, view.state.doc.length, IDLE_PARSE_BUDGET_MS)
    }, { timeout: IDLE_PARSE_TIMEOUT_MS })
  }
}

const viewportParsePlugin = ViewPlugin.fromClass(class {
  private settleTimeout = -1
  private idleCallback: number | null = null

  update(update: ViewUpdate): void {
    if (update.viewportChanged) this.schedule(update.view)
  }

  private schedule(view: EditorView): void {
    if (this.settleTimeout >= 0) window.clearTimeout(this.settleTimeout)
    if (this.idleCallback !== null && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(this.idleCallback)
      this.idleCallback = null
    }

    this.settleTimeout = window.setTimeout(() => {
      this.settleTimeout = -1
      const parse = (): void => {
        this.idleCallback = null
        const target = Math.min(view.state.doc.length, view.viewport.to + VIEWPORT_OVERSHOOT)
        if (!syntaxTreeAvailable(view.state, target)) {
          forceParsing(view, target, VIEWPORT_PARSE_BUDGET_MS)
        }
      }
      if ('requestIdleCallback' in window) {
        this.idleCallback = window.requestIdleCallback(parse, { timeout: IDLE_PARSE_TIMEOUT_MS })
      } else {
        globalThis.setTimeout(parse, 0)
      }
    }, VIEWPORT_PARSE_SETTLE_MS)
  }

  destroy(): void {
    if (this.settleTimeout >= 0) window.clearTimeout(this.settleTimeout)
    if (this.idleCallback !== null && 'cancelIdleCallback' in window) window.cancelIdleCallback(this.idleCallback)
  }
})

const codeBlockHoverPlugin = ViewPlugin.fromClass(class {
  private hoveredInfo: HTMLElement | null = null

  private readonly handlePointerOver = (event: PointerEvent): void => {
    this.setHoveredInfo(this.findInfo(event.target))
  }

  private readonly handlePointerOut = (event: PointerEvent): void => {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && this.view.dom.contains(nextTarget)) {
      this.setHoveredInfo(this.findInfo(nextTarget))
      return
    }
    this.setHoveredInfo(null)
  }

  constructor(private readonly view: EditorView) {
    view.dom.addEventListener('pointerover', this.handlePointerOver)
    view.dom.addEventListener('pointerout', this.handlePointerOut)
  }

  private findInfo(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null
    const line = target.closest('.cm-fenced-code-line')
    if (!(line instanceof HTMLElement) || !this.view.contentDOM.contains(line)) return null

    let firstLine: Element | null = line
    while (firstLine && !firstLine.classList.contains('cm-fenced-code-line-first')) {
      firstLine = firstLine.previousElementSibling
    }
    return firstLine?.querySelector<HTMLElement>('.cm-code-block-info') ?? null
  }

  private setHoveredInfo(nextInfo: HTMLElement | null): void {
    if (nextInfo === this.hoveredInfo) return
    this.hoveredInfo?.classList.remove('cm-code-block-info-hovered')
    nextInfo?.classList.add('cm-code-block-info-hovered')
    this.hoveredInfo = nextInfo
  }

  destroy(): void {
    this.view.dom.removeEventListener('pointerover', this.handlePointerOver)
    this.view.dom.removeEventListener('pointerout', this.handlePointerOut)
    this.setHoveredInfo(null)
  }
})

const keaEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    background: 'transparent',
    color: 'var(--react-dark-700)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflow: 'auto',
    scrollbarWidth: 'none',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '16px',
    lineHeight: '1.72',
  },
  '.cm-scroller::-webkit-scrollbar': { display: 'none' },
  '.cm-content': {
    width: '100%',
    maxWidth: '960px',
    minHeight: '100%',
    flexGrow: '0',
    margin: '0 auto',
    padding: '25px',
    caretColor: 'rgb(var(--react-brand-rgb))',
    cursor: 'text',
  },
  '.cm-line': { paddingInline: '8px' },
  '.cm-code-block-info': {
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity 120ms ease',
  },
  '.cm-fenced-code-line:hover .cm-code-block-info, .cm-code-block-info-hovered': {
    opacity: '1',
    pointerEvents: 'auto',
  },
  '.cm-gutters': { display: 'none' },
  '.cm-selectionBackground, .cm-content ::selection': {
    background: 'color-mix(in srgb, rgb(var(--react-brand-rgb)) 24%, transparent) !important',
  },
  '.cm-selectionLayer': { pointerEvents: 'none' },
  '.cm-latex-math[data-display="block"], .cm-html-widget, .cm-image-block': {
    margin: '0',
    paddingBlock: '12px 18px',
  },
  '.cm-image img': {
    maxWidth: '100%',
    maxHeight: '620px',
    borderRadius: '10px',
  },
  '.cm-checkbox': {
    width: '14px',
    height: '14px',
    margin: '0 5px 0 1px',
    accentColor: 'rgb(var(--react-brand-rgb))',
    verticalAlign: '-1px',
  },
  '.cm-panels': {
    borderColor: 'var(--react-border)',
    background: 'var(--react-light-100)',
    color: 'var(--react-dark-700)',
  },
  '.dark &': { color: 'var(--react-light-200)' },
  '.dark & .cm-content': {
    '--pm-cursor-color': 'var(--react-light-50)',
    caretColor: 'var(--react-light-50)',
  },
  '.dark & .cm-cursor, .dark & .cm-dropCursor': {
    borderLeftColor: 'var(--react-light-50)',
  },
  '.dark & .cm-fenced-code-line': {
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
    background: '#171719',
    color: '#f0f0f2',
  },
  '.dark & .cm-fenced-code-line-first': {
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px 8px 0 0',
  },
  '.dark & .cm-fenced-code-line-last': {
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0 0 8px 8px',
  },
  '.dark & .cm-panels': {
    background: 'transparent',
    color: 'var(--react-light-400)',
  },
})

export function ProseMarkEditor({
  documentId,
  documentPath,
  content,
  contentRevision,
  onChange,
  onEditorChange,
  onEditorStateChange,
  onActiveHeadingChange = () => {},
  onOpenLink,
  topChromeHidden = false,
}: ProseMarkEditorProps) {
  const editorRoot = useRef<HTMLDivElement>(null)
  const editorView = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onEditorChangeRef = useRef(onEditorChange)
  const onEditorStateChangeRef = useRef(onEditorStateChange)
  const onActiveHeadingChangeRef = useRef(onActiveHeadingChange)
  const onOpenLinkRef = useRef(onOpenLink)
  const documentPathRef = useRef(documentPath)
  const applyingExternalContent = useRef(false)
  const pendingLocalChange = useRef(false)
  const publishTimer = useRef<number | null>(null)
  const lastPublishedContent = useRef(content)
  const appliedContentRevision = useRef(contentRevision)
  const [errorMessage, setErrorMessage] = useState('')
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)

  onChangeRef.current = onChange
  onEditorChangeRef.current = onEditorChange
  onEditorStateChangeRef.current = onEditorStateChange
  onActiveHeadingChangeRef.current = onActiveHeadingChange
  onOpenLinkRef.current = onOpenLink
  documentPathRef.current = documentPath

  useEffect(() => {
    const root = editorRoot.current
    if (!root) return

    let disposed = false
    let stateFrame = 0
    let lastCanUndo = false
    let lastCanRedo = false
    let themeObserver: MutationObserver | null = null
    let activeHeadingFrame = 0
    let headingPositions = extractMarkdownHeadings(content)
    let reportedActiveHeading: number | null | undefined
    let mathLoadStarted = false
    const mathCompartment = new Compartment()
    const spellcheckCompartment = new Compartment()
    let spellcheckIdleId: number | null = null

    const enableMathRendering = (view: EditorView, mathIsKnown = false): void => {
      if (mathLoadStarted || (!mathIsKnown && !view.state.doc.toString().includes('$'))) return
      mathLoadStarted = true
      void loadBundledMathJax().then(() => {
        if (disposed) return
        view.dispatch({
          effects: mathCompartment.reconfigure(latexMarkdownEditorExtensions({
            output: 'svg',
            renderCacheSize: 128,
            mathJaxLoadMode: 'static-import',
          })),
        })
      }).catch(error => {
        console.error('Failed to load bundled MathJax:', error)
        if (!disposed) setErrorMessage('Maths rendering is unavailable; Markdown editing still works.')
      })
    }

    const publishContent = (): void => {
      if (publishTimer.current !== null) {
        window.clearTimeout(publishTimer.current)
        publishTimer.current = null
      }
      const view = editorView.current
      if (!view || !pendingLocalChange.current) return
      const nextContent = view.state.doc.toString()
      pendingLocalChange.current = false
      lastPublishedContent.current = nextContent
      onChangeRef.current(nextContent)
    }

    const scheduleContentPublish = (): void => {
      pendingLocalChange.current = true
      if (publishTimer.current !== null) window.clearTimeout(publishTimer.current)
      publishTimer.current = window.setTimeout(publishContent, CONTENT_PUBLISH_DELAY_MS)
    }

    const publishEditorState = (view: EditorView): void => {
      if (stateFrame) return
      stateFrame = window.requestAnimationFrame(() => {
        stateFrame = 0
        const canUndo = undoDepth(view.state) > 0
        const canRedo = redoDepth(view.state) > 0
        if (canUndo === lastCanUndo && canRedo === lastCanRedo) return
        lastCanUndo = canUndo
        lastCanRedo = canRedo
        onEditorStateChangeRef.current()
      })
    }

    const recordViewport = (): void => {
      const view = editorView.current
      if (!view) return
      const selection = view.state.selection.main
      viewportSnapshots.set(documentId, {
        anchor: selection.anchor,
        head: selection.head,
        scrollTop: view.scrollDOM.scrollTop,
      })
    }

    const reportActiveHeading = (view: EditorView): void => {
      const scrollTop = view.scrollDOM.scrollTop
      const maxScrollTop = Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight)
      const activationOffset = Math.min(32, view.defaultLineHeight * 2)
      const headingTops = headingPositions.map(heading => view.lineBlockAt(view.state.doc.lineAt(heading.position).from).top)
      const activeHeading = resolveActiveHeadingPosition(
        headingPositions,
        headingTops,
        {
          scrollTop,
          maxScrollTop,
          activationOffset,
          bottomSpread: Math.min(maxScrollTop, Math.max(180, view.scrollDOM.clientHeight * 0.4)),
          bottomTolerance: Math.max(32, view.defaultLineHeight * 2),
        },
      )

      if (activeHeading === reportedActiveHeading) return
      reportedActiveHeading = activeHeading
      onActiveHeadingChangeRef.current(activeHeading)
    }

    const scheduleActiveHeading = (view: EditorView): void => {
      if (activeHeadingFrame) return
      activeHeadingFrame = window.requestAnimationFrame(() => {
        activeHeadingFrame = 0
        if (!disposed) reportActiveHeading(view)
      })
    }

    try {
      const view = new EditorView({
        parent: root,
        state: EditorState.create({
          doc: content,
          extensions: [
            markdown({
              codeLanguages: languages,
              extensions: [
                GFM,
                markdownCompatibilitySyntax,
                prosemarkMarkdownSyntaxExtensions,
                renderHtmlMarkdownSyntaxExtensions,
              ],
            }),
            prosemarkBasicSetup(),
            prosemarkBaseThemeSetup(),
            keaEditorTheme,
            ...latexMarkdownSyntaxTheme,
            mathCompartment.of([]),
            spellcheckCompartment.of([]),
            htmlBlockExtension,
            pasteRichTextExtension(),
            pastePlainTextExtension(),
            mermaidExtension(),
            tableExtension(),
            localImageExtension(() => documentPathRef.current),
            internalLinkExtension(url => onOpenLinkRef.current(url)),
            imageIngestionExtension(() => documentPathRef.current, setErrorMessage),
            markdownCompatibilityExtension(url => onOpenLinkRef.current(url)),
            viewportParsePlugin,
            codeBlockHoverPlugin,
            EditorView.contentAttributes.of({
              'aria-label': 'Markdown editor',
              'aria-multiline': 'true',
              spellcheck: 'false',
            }),
            EditorView.domEventHandlers({
              blur: () => {
                publishContent()
                recordViewport()
                return false
              },
            }),
            EditorView.updateListener.of(update => {
              const isExternal = update.transactions.some(transaction => transaction.isUserEvent('kea.external'))
              if (update.docChanged && !applyingExternalContent.current && !isExternal) scheduleContentPublish()
              if (update.docChanged && !mathLoadStarted) {
                const insertedMath = update.transactions.some(transaction => {
                  let includesDollar = false
                  transaction.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
                    if (!includesDollar && inserted.toString().includes('$')) includesDollar = true
                  })
                  return includesDollar
                })
                if (insertedMath) enableMathRendering(update.view, true)
              }
              if (update.docChanged || update.selectionSet || update.viewportChanged) {
                recordViewport()
              }
              if (update.docChanged) headingPositions = extractMarkdownHeadings(update.view.state.doc.toString())
              if (update.docChanged || update.viewportChanged) scheduleActiveHeading(update.view)
              if (update.docChanged) publishEditorState(update.view)
            }),
          ],
        }),
      })

      editorView.current = view
      lastPublishedContent.current = content
      appliedContentRevision.current = contentRevision
      onEditorChangeRef.current(createCodeMirrorController(view))
      setScrollElement(view.scrollDOM)
      const handleActiveHeadingScroll = (): void => scheduleActiveHeading(view)
      view.scrollDOM.addEventListener('scroll', recordViewport, { passive: true })
      view.scrollDOM.addEventListener('scroll', handleActiveHeadingScroll, { passive: true })
      scheduleActiveHeading(view)
      themeObserver = new MutationObserver(() => {
        view.dispatch({ selection: view.state.selection })
      })
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

      const snapshot = viewportSnapshots.get(documentId)
      if (snapshot) {
        view.dispatch({
          selection: EditorSelection.range(
            clamp(snapshot.anchor, 0, view.state.doc.length),
            clamp(snapshot.head, 0, view.state.doc.length),
          ),
          scrollIntoView: false,
        })
        window.requestAnimationFrame(() => {
          view.scrollDOM.scrollTop = snapshot.scrollTop
          scheduleActiveHeading(view)
        })
      }

      advanceViewportParse(view, () => disposed)
      enableMathRendering(view)
      const loadSpellcheck = (): void => {
        void import('./spellcheck').then(module => {
          if (!disposed) view.dispatch({ effects: spellcheckCompartment.reconfigure(module.createKeaSpellcheckExtensions()) })
        }).catch(error => {
          console.error('Failed to load spellcheck:', error)
          if (!disposed) setErrorMessage('Spellcheck is unavailable; Markdown editing still works.')
        })
      }
      if (typeof window.requestIdleCallback === 'function') spellcheckIdleId = window.requestIdleCallback(loadSpellcheck, { timeout: 1500 })
      else spellcheckIdleId = globalThis.setTimeout(loadSpellcheck, 250)
      view.focus()
      setErrorMessage('')

      return () => {
        disposed = true
        publishContent()
        recordViewport()
        if (stateFrame) window.cancelAnimationFrame(stateFrame)
        if (activeHeadingFrame) window.cancelAnimationFrame(activeHeadingFrame)
        if (spellcheckIdleId !== null) {
          if ('cancelIdleCallback' in window) window.cancelIdleCallback(spellcheckIdleId)
          else globalThis.clearTimeout(spellcheckIdleId)
        }
        themeObserver?.disconnect()
        view.scrollDOM.removeEventListener('scroll', recordViewport)
        view.scrollDOM.removeEventListener('scroll', handleActiveHeadingScroll)
        onActiveHeadingChangeRef.current(null)
        onEditorChangeRef.current(null)
        setScrollElement(null)
        editorView.current = null
        view.destroy()
      }
    } catch (error) {
      console.error('Failed to create ProseMark editor:', error)
      setErrorMessage('Failed to initialise the Markdown editor.')
      onEditorChangeRef.current(null)
    }
  }, [documentId])

  useEffect(() => {
    const view = editorView.current
    if (!view || contentRevision === appliedContentRevision.current) return
    appliedContentRevision.current = contentRevision
    if (view.state.doc.toString() === content) {
      lastPublishedContent.current = content
      return
    }

    if (publishTimer.current !== null) {
      window.clearTimeout(publishTimer.current)
      publishTimer.current = null
    }
    pendingLocalChange.current = false
    applyingExternalContent.current = true
    try {
      const current = view.state.doc.toString()
      let prefixLength = 0
      const sharedLength = Math.min(current.length, content.length)
      while (prefixLength < sharedLength && current[prefixLength] === content[prefixLength]) prefixLength++

      let suffixLength = 0
      while (
        suffixLength < sharedLength - prefixLength
        && current[current.length - suffixLength - 1] === content[content.length - suffixLength - 1]
      ) suffixLength++

      view.dispatch({
        changes: {
          from: prefixLength,
          to: current.length - suffixLength,
          insert: content.slice(prefixLength, content.length - suffixLength),
        },
        annotations: Transaction.addToHistory.of(false),
        userEvent: 'kea.external',
      })
      lastPublishedContent.current = content
    } finally {
      applyingExternalContent.current = false
    }
  }, [contentRevision])

  return (
    <div className="prosemark-editor-shell relative h-full min-h-0 w-full select-text overflow-hidden [--accent:rgb(var(--react-brand-rgb))] [--bg-base:var(--react-light-50)] [--border-color:var(--react-border)] [--fg-base:var(--react-dark-700)] [--link-color:rgb(var(--react-brand-rgb))] [--pm-blockquote-vertical-line-background-color:rgb(var(--react-brand-rgb))] [--pm-code-background-color:#f1f1f3] [--pm-code-btn-background-color:rgba(0,0,0,0.06)] [--pm-code-btn-hover-background-color:rgba(0,0,0,0.11)] [--pm-code-font:'SF_Mono','Monaco','Cascadia_Mono','Roboto_Mono',monospace] [--pm-cursor-color:rgb(var(--react-brand-rgb))] [--pm-header-mark-color:var(--react-dark-400)] [--pm-latex-math-error-background-color:rgba(180,35,24,0.08)] [--pm-latex-math-error-color:#b42318] [--pm-latex-math-formula-color:var(--react-dark-700)] [--pm-link-color:rgb(var(--react-brand-rgb))] [--pm-muted-color:var(--react-dark-500)] [--surface-card:var(--react-light-50)] [--surface-subtle:color-mix(in_srgb,var(--react-dark-200)_55%,transparent)] [--text-error:#b42318] [--text-muted:var(--react-dark-500)] [--text-primary:var(--react-dark-700)] [--text-secondary:var(--react-dark-500)] dark:[--bg-base:#111113] dark:[--border-color:rgba(255,255,255,0.12)] dark:[--fg-base:var(--react-light-200)] dark:[--pm-code-background-color:#171719] dark:[--pm-code-btn-background-color:rgba(255,255,255,0.08)] dark:[--pm-code-btn-hover-background-color:rgba(255,255,255,0.15)] dark:[--pm-cursor-color:var(--react-light-50)] dark:[--pm-header-mark-color:var(--react-light-500)] dark:[--pm-latex-math-error-background-color:rgba(255,180,171,0.09)] dark:[--pm-latex-math-error-color:#ffb4ab] dark:[--pm-latex-math-formula-color:var(--react-light-200)] dark:[--pm-muted-color:var(--react-light-400)] dark:[--surface-card:#1d1d1f] dark:[--surface-subtle:#171719] dark:[--text-error:#ffb4ab] dark:[--text-muted:var(--react-light-400)] dark:[--text-primary:var(--react-light-200)] dark:[--text-secondary:var(--react-light-400)]">
      {errorMessage && <div className="absolute top-3 right-4 z-[2] select-text rounded-lg bg-[rgba(207,34,46,0.12)] px-2.5 py-1.5 text-xs text-[#b42318]" role="alert">{errorMessage}</div>}
      <div ref={editorRoot} className="h-full min-h-0 w-full" />
      <CurvedEditorScrollbar scrollElement={scrollElement} curveTop={topChromeHidden} />
    </div>
  )
}
