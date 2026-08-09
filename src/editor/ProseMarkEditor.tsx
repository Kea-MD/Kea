import { useEffect, useRef, useState } from 'react'
import { markdown } from '@codemirror/lang-markdown'
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

interface ProseMarkEditorProps {
  documentId: string
  documentPath: string
  content: string
  onChange: (content: string) => void
  onEditorChange: (editor: EditorController | null) => void
  onEditorStateChange: () => void
  onOpenLink: (url: string) => void
}

interface ViewportSnapshot {
  anchor: number
  head: number
  scrollTop: number
}

const viewportSnapshots = new Map<string, ViewportSnapshot>()
const CONTENT_PUBLISH_DELAY_MS = 140
const VIEWPORT_OVERSHOOT = 2000
const VIEWPORT_PARSE_BUDGET_MS = 50
const IDLE_PARSE_BUDGET_MS = 50
const IDLE_PARSE_TIMEOUT_MS = 2000

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function advanceViewportParse(view: EditorView, isDisposed: () => boolean): void {
  const target = Math.min(view.state.doc.length, view.viewport.to + VIEWPORT_OVERSHOOT)
  forceParsing(view, target, VIEWPORT_PARSE_BUDGET_MS)

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      if (!isDisposed()) forceParsing(view, view.state.doc.length, IDLE_PARSE_BUDGET_MS)
    }, { timeout: IDLE_PARSE_TIMEOUT_MS })
  }
}

const viewportParsePlugin = ViewPlugin.fromClass(class {
  private timeout = -1

  update(update: ViewUpdate): void {
    if (!update.viewportChanged || this.timeout >= 0) return
    const target = Math.min(update.state.doc.length, update.view.viewport.to + VIEWPORT_OVERSHOOT)
    if (syntaxTreeAvailable(update.state, target)) return

    this.timeout = window.setTimeout(() => {
      this.timeout = -1
      const nextTarget = Math.min(update.view.state.doc.length, update.view.viewport.to + VIEWPORT_OVERSHOOT)
      if (!syntaxTreeAvailable(update.view.state, nextTarget)) {
        forceParsing(update.view, nextTarget, VIEWPORT_PARSE_BUDGET_MS)
      }
    }, 0)
  }

  destroy(): void {
    if (this.timeout >= 0) window.clearTimeout(this.timeout)
  }
})

export function ProseMarkEditor({
  documentId,
  documentPath,
  content,
  onChange,
  onEditorChange,
  onEditorStateChange,
  onOpenLink,
}: ProseMarkEditorProps) {
  const editorRoot = useRef<HTMLDivElement>(null)
  const editorView = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onEditorChangeRef = useRef(onEditorChange)
  const onEditorStateChangeRef = useRef(onEditorStateChange)
  const onOpenLinkRef = useRef(onOpenLink)
  const documentPathRef = useRef(documentPath)
  const applyingExternalContent = useRef(false)
  const pendingLocalChange = useRef(false)
  const publishTimer = useRef<number | null>(null)
  const lastPublishedContent = useRef(content)
  const [errorMessage, setErrorMessage] = useState('')

  onChangeRef.current = onChange
  onEditorChangeRef.current = onEditorChange
  onEditorStateChangeRef.current = onEditorStateChange
  onOpenLinkRef.current = onOpenLink
  documentPathRef.current = documentPath

  useEffect(() => {
    const root = editorRoot.current
    if (!root) return

    let disposed = false
    let stateFrame = 0
    let themeObserver: MutationObserver | null = null
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

    const publishEditorState = (): void => {
      if (stateFrame) return
      stateFrame = window.requestAnimationFrame(() => {
        stateFrame = 0
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
                publishEditorState()
              }
            }),
          ],
        }),
      })

      editorView.current = view
      lastPublishedContent.current = content
      onEditorChangeRef.current(createCodeMirrorController(view))
      view.scrollDOM.addEventListener('scroll', recordViewport, { passive: true })
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
        if (spellcheckIdleId !== null) {
          if ('cancelIdleCallback' in window) window.cancelIdleCallback(spellcheckIdleId)
          else globalThis.clearTimeout(spellcheckIdleId)
        }
        themeObserver?.disconnect()
        view.scrollDOM.removeEventListener('scroll', recordViewport)
        onEditorChangeRef.current(null)
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
    if (!view || pendingLocalChange.current || content === lastPublishedContent.current) return
    if (view.state.doc.toString() === content) {
      lastPublishedContent.current = content
      return
    }

    applyingExternalContent.current = true
    try {
      const cursor = Math.min(view.state.selection.main.head, content.length)
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        selection: EditorSelection.cursor(cursor),
        annotations: Transaction.addToHistory.of(false),
        userEvent: 'kea.external',
      })
      lastPublishedContent.current = content
    } finally {
      applyingExternalContent.current = false
    }
  }, [content])

  return (
    <div className="prosemark-editor-shell">
      {errorMessage && <div className="prosemark-editor-status is-error" role="alert">{errorMessage}</div>}
      <div ref={editorRoot} className="prosemark-editor-mount" />
    </div>
  )
}
