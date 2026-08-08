import { useEffect, useRef, useState } from 'react'
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  rootCtx,
} from '@milkdown/kit/core'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { nord } from '@milkdown/theme-nord'
import type { Node as ProseMirrorNode } from '@milkdown/prose/model'
import { TextSelection } from '@milkdown/prose/state'
import type { EditorView as ProseMirrorEditorView } from '@milkdown/prose/view'
import {
  getRenderedViewportRestore,
  recordRenderedViewportSnapshot,
} from '../modules/editor/runtime/editorViewportSync'
import '@milkdown/theme-nord/style.css'

export interface MilkdownEditorProps {
  documentId: string
  content: string
  onChange: (content: string) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function canScroll(element: HTMLElement): boolean {
  return element.scrollHeight - element.clientHeight > 1
}

function hasScrollableStyle(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  return style.overflowY === 'auto'
    || style.overflowY === 'scroll'
    || style.overflow === 'auto'
    || style.overflow === 'scroll'
}

function getScrollRatio(container: HTMLElement): number {
  const maxScroll = container.scrollHeight - container.clientHeight
  if (maxScroll <= 0) return 0
  return clamp(container.scrollTop / maxScroll, 0, 1)
}

function setScrollByRatio(container: HTMLElement, ratio: number): void {
  const maxScroll = container.scrollHeight - container.clientHeight
  if (maxScroll <= 0) return
  container.scrollTop = clamp(Number.isFinite(ratio) ? ratio : 0, 0, 1) * maxScroll
}

function getPlainPrefixLengthAtPmPos(doc: ProseMirrorNode, position: number): number {
  const safePosition = clamp(Math.round(position), 0, doc.content.size)
  return doc.textBetween(0, safePosition, '\n', '\n').length
}

function mapPmPosToPlainOffset(doc: ProseMirrorNode, position: number): number {
  return getPlainPrefixLengthAtPmPos(doc, position)
}

function mapPlainOffsetToPmPos(doc: ProseMirrorNode, plainOffset: number): number {
  const fullLength = getPlainPrefixLengthAtPmPos(doc, doc.content.size)
  const safeOffset = clamp(Math.round(plainOffset), 0, fullLength)
  let low = 0
  let high = doc.content.size

  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (getPlainPrefixLengthAtPmPos(doc, mid) < safeOffset) low = mid + 1
    else high = mid
  }

  return low
}

export function MilkdownEditor({ documentId, content, onChange }: MilkdownEditorProps) {
  const editorRoot = useRef<HTMLDivElement>(null)
  const editor = useRef<Editor | null>(null)
  const editorView = useRef<ProseMirrorEditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const restoringViewport = useRef(false)
  const activeScrollContainer = useRef<HTMLElement | null>(null)
  const lastKnownScrollRatio = useRef(0)
  const [isReady, setIsReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const root = editorRoot.current
    if (!root) return

    let destroyed = false
    let removeViewportListeners: (() => void) | undefined

    const resolveScrollContainer = (): HTMLElement | null => {
      const view = editorView.current
      const candidates: HTMLElement[] = [root]
      root.querySelectorAll<HTMLElement>('.milkdown, .milkdown .editor, .ProseMirror').forEach(element => candidates.push(element))
      if (view?.dom.parentElement) candidates.push(view.dom.parentElement)
      if (view?.dom) candidates.push(view.dom)
      return Array.from(new Set(candidates)).find(canScroll)
        ?? Array.from(new Set(candidates)).find(hasScrollableStyle)
        ?? root
    }

    const getScrollContainer = (): HTMLElement | null => {
      if (activeScrollContainer.current?.isConnected) return activeScrollContainer.current
      activeScrollContainer.current = resolveScrollContainer()
      return activeScrollContainer.current
    }

    const getPlainText = (): string => {
      const view = editorView.current
      if (!view) return ''
      return view.state.doc.textBetween(0, view.state.doc.content.size, '\n', '\n')
    }

    const publishViewportSnapshot = (): void => {
      const view = editorView.current
      if (!view || restoringViewport.current) return
      const container = getScrollContainer()
      const scrollRatio = container ? getScrollRatio(container) : lastKnownScrollRatio.current
      if (container) lastKnownScrollRatio.current = scrollRatio
      recordRenderedViewportSnapshot({
        documentId,
        plainText: getPlainText(),
        plainCursorOffset: mapPmPosToPlainOffset(view.state.doc, view.state.selection.from),
        pmPos: view.state.selection.from,
        scrollRatio,
      })
    }

    const restoreViewportSnapshot = (): void => {
      const view = editorView.current
      if (!view) return
      const plainText = getPlainText()
      const restore = getRenderedViewportRestore(documentId, plainText)
      if (!restore) return

      const doc = view.state.doc
      const pmPos = typeof restore.pmPos === 'number'
        ? clamp(Math.round(restore.pmPos), 0, doc.content.size)
        : mapPlainOffsetToPmPos(doc, restore.plainCursorOffset)
      restoringViewport.current = true
      const selection = pmPos <= 0 ? TextSelection.atStart(doc) : TextSelection.create(doc, pmPos, pmPos)
      view.dispatch(view.state.tr.setSelection(selection))

      const applyScrollRestore = (attempt = 0): void => {
        const container = getScrollContainer()
        if (!container) {
          restoringViewport.current = false
          return
        }
        setScrollByRatio(container, restore.scrollRatio)
        lastKnownScrollRatio.current = getScrollRatio(container)
        if (attempt >= 4 || Math.abs(getScrollRatio(container) - restore.scrollRatio) <= 0.02) {
          restoringViewport.current = false
          return
        }
        window.requestAnimationFrame(() => applyScrollRestore(attempt + 1))
      }

      window.requestAnimationFrame(() => applyScrollRestore())
    }

    const bindViewportListeners = (): void => {
      const view = editorView.current
      if (!view) return
      const scrollContainer = getScrollContainer()
      const handleViewportChange = () => {
        if (!restoringViewport.current) publishViewportSnapshot()
      }
      view.dom.addEventListener('mouseup', handleViewportChange)
      view.dom.addEventListener('keyup', handleViewportChange)
      view.dom.addEventListener('click', handleViewportChange)
      view.dom.addEventListener('focusin', handleViewportChange)
      scrollContainer?.addEventListener('scroll', handleViewportChange, { passive: true })
      removeViewportListeners = () => {
        view.dom.removeEventListener('mouseup', handleViewportChange)
        view.dom.removeEventListener('keyup', handleViewportChange)
        view.dom.removeEventListener('click', handleViewportChange)
        view.dom.removeEventListener('focusin', handleViewportChange)
        scrollContainer?.removeEventListener('scroll', handleViewportChange)
      }
    }

    const createEditor = async (): Promise<void> => {
      setIsReady(false)
      setErrorMessage('')
      try {
        const createdEditor = await Editor.make()
          .config(nord)
          .config((ctx) => {
            ctx.set(rootCtx, root)
            ctx.set(defaultValueCtx, content)
            ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, previousMarkdown) => {
              if (markdown === previousMarkdown || restoringViewport.current) return
              onChangeRef.current(markdown)
              publishViewportSnapshot()
            })
          })
          .use(commonmark)
          .use(gfm)
          .use(clipboard)
          .use(history)
          .use(listener)
          .create()

        if (destroyed) {
          createdEditor.destroy()
          return
        }

        editor.current = createdEditor
        createdEditor.action((ctx) => {
          editorView.current = ctx.get(editorViewCtx)
        })
        const view = editorView.current
        if (!view) throw new Error('Milkdown editor view was not created')
        if (view.dom.getClientRects().length > 0) {
          try {
            view.dom.focus({ preventScroll: true })
          } catch {
            view.dom.focus()
          }
        }
        restoreViewportSnapshot()
        bindViewportListeners()
        setIsReady(true)
      } catch (error) {
        if (destroyed) return
        console.error('Failed to create Milkdown editor:', error)
        setErrorMessage('Failed to initialise rendered editor.')
      }
    }

    void createEditor()

    return () => {
      destroyed = true
      removeViewportListeners?.()
      removeViewportListeners = undefined
      activeScrollContainer.current = null
      lastKnownScrollRatio.current = 0
      editorView.current = null
      editor.current?.destroy()
      editor.current = null
    }
  }, [documentId])

  return (
    <div className="milkdown-editor-shell" data-testid="react-milkdown-editor">
      {!isReady && !errorMessage && <div className="milkdown-status" role="status">Loading rendered editor...</div>}
      {errorMessage && <div className="milkdown-status is-error" role="alert">{errorMessage}</div>}
      <div ref={editorRoot} className="milkdown-editor" />
    </div>
  )
}
