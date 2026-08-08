import { useEffect, useRef, useState } from 'react'
import { EditorSelection, EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import {
  getSourceViewportRestore,
  recordSourceViewportSnapshot,
} from '../modules/editor/runtime/editorViewportSync'

export interface CodeMirrorEditorProps {
  documentId: string
  content: string
  onChange: (content: string) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getScrollRatio(container: HTMLElement): number {
  const maxScroll = container.scrollHeight - container.clientHeight
  if (maxScroll <= 0) return 0
  return clamp(container.scrollTop / maxScroll, 0, 1)
}

function setScrollByRatio(container: HTMLElement, ratio: number): void {
  const maxScroll = container.scrollHeight - container.clientHeight
  if (maxScroll <= 0) return
  container.scrollTop = clamp(ratio, 0, 1) * maxScroll
}

export function CodeMirrorEditor({ documentId, content, onChange }: CodeMirrorEditorProps) {
  const editorRoot = useRef<HTMLDivElement>(null)
  const editorView = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const applyingStoreContent = useRef(false)
  const restoringViewport = useRef(false)
  const scrollContainer = useRef<HTMLElement | null>(null)
  const lastKnownScrollRatio = useRef(0)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const root = editorRoot.current
    if (!root) return

    let view: EditorView | null = null
    let activeScrollContainer: HTMLElement | null = null

    const getScrollContainer = (): HTMLElement | null => {
      if (activeScrollContainer?.isConnected) return activeScrollContainer
      activeScrollContainer = view?.scrollDOM ?? root.querySelector<HTMLElement>('.cm-scroller') ?? root
      scrollContainer.current = activeScrollContainer
      return activeScrollContainer
    }

    const publishViewportSnapshot = () => {
      if (!view || restoringViewport.current) return
      const container = getScrollContainer()
      const scrollRatio = container ? getScrollRatio(container) : lastKnownScrollRatio.current
      if (container) lastKnownScrollRatio.current = scrollRatio
      recordSourceViewportSnapshot({
        documentId,
        markdown: view.state.doc.toString(),
        cursorOffset: view.state.selection.main.head,
        scrollRatio,
      })
    }

    const handleScroll = () => {
      if (!restoringViewport.current) publishViewportSnapshot()
    }

    try {
      view = new EditorView({
        parent: root,
        state: EditorState.create({
          doc: content,
          extensions: [
            lineNumbers(),
            history(),
            markdown(),
            EditorView.lineWrapping,
            keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
            EditorView.updateListener.of((update) => {
              if (!update.docChanged || applyingStoreContent.current || restoringViewport.current) return
              onChangeRef.current(update.state.doc.toString())
              publishViewportSnapshot()
            }),
            EditorView.updateListener.of((update) => {
              if (!update.selectionSet || applyingStoreContent.current || restoringViewport.current) return
              publishViewportSnapshot()
            }),
          ],
        }),
      })
      editorView.current = view

      activeScrollContainer = view.scrollDOM
      scrollContainer.current = activeScrollContainer
      activeScrollContainer.addEventListener('scroll', handleScroll, { passive: true })

      const restore = getSourceViewportRestore(documentId, content)
      if (restore) {
        const cursorOffset = clamp(Math.round(restore.cursorOffset), 0, view.state.doc.length)
        restoringViewport.current = true
        view.dispatch({
          selection: EditorSelection.cursor(cursorOffset),
          scrollIntoView: false,
        })
        window.requestAnimationFrame(() => {
          const container = getScrollContainer()
          if (container) {
            setScrollByRatio(container, restore.scrollRatio)
            lastKnownScrollRatio.current = getScrollRatio(container)
          }
          window.requestAnimationFrame(() => {
            restoringViewport.current = false
          })
        })
      }

      try {
        view.contentDOM.focus({ preventScroll: true })
      } catch {
        view.contentDOM.focus()
      }
      setErrorMessage('')
    } catch (error) {
      console.error('Failed to create CodeMirror editor:', error)
      setErrorMessage('Failed to initialise source editor.')
    }

    return () => {
      activeScrollContainer?.removeEventListener('scroll', handleScroll)
      editorView.current = null
      scrollContainer.current = null
      lastKnownScrollRatio.current = 0
      view?.destroy()
      view = null
    }
  }, [documentId])

  useEffect(() => {
    const view = editorView.current
    if (!view || view.state.doc.toString() === content) return

    applyingStoreContent.current = true
    try {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      })
    } finally {
      applyingStoreContent.current = false
    }
  }, [content])

  return (
    <div className="code-mirror-shell" data-testid="react-code-mirror-editor">
      {errorMessage && <div className="code-mirror-status is-error" role="alert">{errorMessage}</div>}
      <div ref={editorRoot} className="code-mirror-editor" />
    </div>
  )
}
