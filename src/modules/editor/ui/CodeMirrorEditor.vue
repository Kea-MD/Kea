<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorSelection, EditorState } from '@codemirror/state'
import { history, historyKeymap, indentWithTab, defaultKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { useDocumentStore } from '../state/documentStore'
import {
  getSourceViewportRestore,
  recordSourceViewportSnapshot,
} from '../runtime/editorViewportSync'

const documentStore = useDocumentStore()
const editorRoot = ref<HTMLDivElement | null>(null)
const errorMessage = ref('')

let editorView: EditorView | null = null
let isApplyingStoreContent = false
let isRestoringViewport = false
let removeScrollListener: (() => void) | null = null
let editorDocumentId: string | null = null
let activeScrollContainer: HTMLElement | null = null
let lastKnownScrollRatio = 0

const activeContent = computed(() => documentStore.currentFile?.content ?? '')

function getCursorPreview(text: string, offset: number): string {
  const safeOffset = clamp(Math.round(offset), 0, text.length)
  const start = Math.max(0, safeOffset - 12)
  const end = Math.min(text.length, safeOffset + 12)
  return text.slice(start, end).replace(/\n/g, '\\n')
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getScrollRatio(container: HTMLElement): number {
  const maxScroll = container.scrollHeight - container.clientHeight
  if (maxScroll <= 0) return 0
  return clamp(container.scrollTop / maxScroll, 0, 1)
}

function resolveScrollContainer(): HTMLElement | null {
  if (!editorView) return editorRoot.value

  const primary = editorView.scrollDOM
  if (primary) return primary

  const fallback = editorRoot.value?.querySelector<HTMLElement>('.cm-scroller')
  return fallback ?? editorRoot.value
}

function getScrollContainer(): HTMLElement | null {
  if (activeScrollContainer?.isConnected) return activeScrollContainer

  activeScrollContainer = resolveScrollContainer()
  return activeScrollContainer
}

function setScrollByRatio(container: HTMLElement, ratio: number): void {
  const maxScroll = container.scrollHeight - container.clientHeight
  if (maxScroll <= 0) return

  const safeRatio = Number.isFinite(ratio) ? clamp(ratio, 0, 1) : 0
  container.scrollTop = safeRatio * maxScroll
}

function publishViewportSnapshot(): void {
  if (!editorView || !editorDocumentId || isRestoringViewport) return

  const markdownText = editorView.state.doc.toString()
  const cursorOffset = editorView.state.selection.main.head
  const scrollContainer = getScrollContainer()
  const scrollRatio = scrollContainer
    ? getScrollRatio(scrollContainer)
    : lastKnownScrollRatio

  if (scrollContainer) {
    lastKnownScrollRatio = scrollRatio
  }

  recordSourceViewportSnapshot({
    documentId: editorDocumentId,
    markdown: markdownText,
    cursorOffset,
    scrollRatio,
  })
}

function restoreViewportSnapshot(markdownText: string): void {
  if (!editorView || !editorDocumentId) return

  const restore = getSourceViewportRestore(editorDocumentId, markdownText)
  if (!restore) return

  const maxOffset = editorView.state.doc.length
  const cursorOffset = clamp(Math.round(restore.cursorOffset), 0, maxOffset)
  isRestoringViewport = true

  editorView.dispatch({
    selection: EditorSelection.cursor(cursorOffset),
    scrollIntoView: false,
  })

  const appliedOffset = editorView.state.selection.main.head
  console.debug('[viewport-sync][codemirror] cursor restored after switch', {
    documentId: editorDocumentId,
    requestedOffset: restore.cursorOffset,
    appliedOffset,
    preview: getCursorPreview(markdownText, appliedOffset),
  })

  requestAnimationFrame(() => {
    const container = getScrollContainer()
    if (!container) {
      isRestoringViewport = false
      return
    }

    setScrollByRatio(container, restore.scrollRatio)
    lastKnownScrollRatio = getScrollRatio(container)

    requestAnimationFrame(() => {
      isRestoringViewport = false
    })
  })
}

function focusEditorWithoutScrolling(): void {
  if (!editorView) return

  const focusTarget = editorView.contentDOM
  try {
    focusTarget.focus({ preventScroll: true })
  } catch {
    focusTarget.focus()
  }
}

const createEditor = () => {
  const root = editorRoot.value
  if (!root || editorView) return

  try {
    editorDocumentId = documentStore.activeDocumentId
    const initialDoc = activeContent.value

    editorView = new EditorView({
      parent: root,
      state: EditorState.create({
        doc: initialDoc,
        extensions: [
          lineNumbers(),
          history(),
          markdown(),
          EditorView.lineWrapping,
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || isApplyingStoreContent || isRestoringViewport) return
            documentStore.updateContent(update.state.doc.toString())

            publishViewportSnapshot()
          }),
          EditorView.updateListener.of((update) => {
            if (!update.selectionSet || isApplyingStoreContent || isRestoringViewport) return
            publishViewportSnapshot()
          }),
        ],
      }),
    })

    const handleScroll = () => {
      if (isRestoringViewport) return
      publishViewportSnapshot()
    }

    activeScrollContainer = resolveScrollContainer()
    const scrollContainer = getScrollContainer()

    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true })
    removeScrollListener = () => {
      scrollContainer?.removeEventListener('scroll', handleScroll)
    }

    focusEditorWithoutScrolling()
    restoreViewportSnapshot(initialDoc)

    errorMessage.value = ''
  } catch (error) {
    console.error('Failed to create CodeMirror editor:', error)
    errorMessage.value = 'Failed to initialise source editor.'
  }
}

watch(activeContent, (nextContent) => {
  if (!editorView) return

  const currentContent = editorView.state.doc.toString()
  if (currentContent === nextContent) return

  isApplyingStoreContent = true
  try {
    editorView.dispatch({
      changes: {
        from: 0,
        to: currentContent.length,
        insert: nextContent,
      },
    })
  } finally {
    isApplyingStoreContent = false
  }
})

onMounted(() => {
  createEditor()
})

onUnmounted(() => {
  if (editorView && editorDocumentId) {
    const scrollContainer = getScrollContainer()
    const scrollRatio = scrollContainer
      ? getScrollRatio(scrollContainer)
      : lastKnownScrollRatio
    const markdownText = editorView.state.doc.toString()
    const cursorOffset = editorView.state.selection.main.head

    console.debug('[viewport-sync][codemirror] final position before switch', {
      documentId: editorDocumentId,
      cursorOffset,
      scrollRatio,
      preview: getCursorPreview(markdownText, cursorOffset),
    })
  }

  removeScrollListener?.()
  removeScrollListener = null
  activeScrollContainer = null
  lastKnownScrollRatio = 0
  editorView?.destroy()
  editorView = null
  editorDocumentId = null
})
</script>

<template>
  <div class="code-mirror-shell">
    <div v-if="errorMessage" class="code-mirror-status is-error">
      {{ errorMessage }}
    </div>
    <div ref="editorRoot" class="code-mirror-editor" />
  </div>
</template>

<style scoped>
.code-mirror-shell {
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
}

.code-mirror-editor {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.code-mirror-status {
  position: absolute;
  top: 12px;
  right: 16px;
  z-index: 2;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  background: var(--tt-gray-light-100);
  color: var(--tt-gray-light-700);
}

.code-mirror-status.is-error {
  background: rgba(207, 34, 46, 0.12);
  color: #b42318;
}

.dark .code-mirror-status {
  background: var(--tt-gray-dark-100);
  color: var(--tt-gray-dark-700);
}

.code-mirror-editor :deep(.cm-editor) {
  height: 100%;
  background: transparent;
}

.code-mirror-editor :deep(.cm-editor.cm-focused) {
  outline: none;
}

.code-mirror-editor :deep(.cm-scroller) {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Mono', 'Roboto Mono', monospace;
  line-height: 1.5;
}

.code-mirror-editor :deep(.cm-content) {
  padding: 10px 20px;
}

.code-mirror-editor :deep(.cm-gutters) {
  border-right: 1px solid var(--tt-gray-light-300);
  background: transparent;
}

.dark .code-mirror-editor :deep(.cm-gutters) {
  border-right-color: var(--tt-gray-dark-300);
}
</style>
