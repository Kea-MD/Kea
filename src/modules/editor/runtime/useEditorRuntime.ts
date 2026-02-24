import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
} from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redoDepth,
  undoDepth,
} from '@codemirror/commands'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language'
import { markdown, markdownKeymap } from '@codemirror/lang-markdown'
import { search, searchKeymap } from '@codemirror/search'

import { useDocumentStore } from '../state/documentStore'
import {
  addEditorCommandListener,
  dispatchEditorUiState,
  type EditorMode,
} from '../editorCommands'
import {
  buildEditorCommandKeymap,
  runEditorCommand,
} from './codeMirror'
import { renderedMarkdownMode } from './renderedPreviewExtension'

type DocumentStore = ReturnType<typeof useDocumentStore>

export function useEditorRuntime(documentStore: DocumentStore) {
  const editorHost = ref<HTMLDivElement | null>(null)

  let editorView: EditorView | null = null
  let removeEditorCommandListener: (() => void) | null = null

  const editorModeCompartment = new Compartment()
  const storeSyncAnnotation = Annotation.define<boolean>()

  const hasOpenFile = computed(() => documentStore.currentFile !== null)
  const isRenderedMode = computed(() => documentStore.editorMode === 'rendered')

  let lastEditorUiState = {
    findOpen: false,
    canUndo: false,
    canRedo: false,
  }

  function isFindPanelOpen(view: EditorView): boolean {
    return view.dom.querySelector('.cm-search') !== null
  }

  function syncEditorUiState(view: EditorView | null) {
    const nextState = view
      ? {
        findOpen: isFindPanelOpen(view),
        canUndo: undoDepth(view.state) > 0,
        canRedo: redoDepth(view.state) > 0,
      }
      : {
        findOpen: false,
        canUndo: false,
        canRedo: false,
      }

    if (
      nextState.findOpen === lastEditorUiState.findOpen
      && nextState.canUndo === lastEditorUiState.canUndo
      && nextState.canRedo === lastEditorUiState.canRedo
    ) {
      return
    }

    lastEditorUiState = nextState
    dispatchEditorUiState(nextState)
  }

  function buildModeExtensions(mode: EditorMode) {
    return mode === 'rendered'
      ? [renderedMarkdownMode()]
      : [lineNumbers()]
  }

  function createEditor(initialContent: string) {
    if (!editorHost.value || editorView) return

    const extensions = [
      EditorView.lineWrapping,
      editorModeCompartment.of(buildModeExtensions(documentStore.editorMode)),
      highlightSpecialChars(),
      drawSelection(),
      highlightActiveLine(),
      history(),
      closeBrackets(),
      search({ top: true }),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      placeholder('Start writing markdown...'),
      EditorView.domEventHandlers({
        keydown(event, view) {
          if (event.key !== 'Escape') return false
          if (documentStore.editorMode !== 'rendered') return false
          if (isFindPanelOpen(view)) return false

          event.preventDefault()
          event.stopPropagation()
          view.contentDOM.blur()
          return true
        },
      }),
      keymap.of([
        ...buildEditorCommandKeymap(),
        ...markdownKeymap,
        ...closeBracketsKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...defaultKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        queueMicrotask(() => {
          syncEditorUiState(update.view)
        })

        if (!update.docChanged) return

        const isStoreSync = update.transactions.some((tr) =>
          tr.annotation(storeSyncAnnotation),
        )
        if (isStoreSync) return

        documentStore.updateContent(update.state.doc.toString())
      }),
    ]

    editorView = new EditorView({
      state: EditorState.create({
        doc: initialContent,
        extensions,
      }),
      parent: editorHost.value,
    })

    syncEditorUiState(editorView)
  }

  function destroyEditor() {
    editorView?.destroy()
    editorView = null
    syncEditorUiState(null)
  }

  function syncEditorFromStore(resetSelection = false) {
    if (!editorView) return

    const storeContent = documentStore.currentFile?.content ?? ''
    const currentContent = editorView.state.doc.toString()

    if (storeContent === currentContent) {
      return
    }

    const currentSelection = editorView.state.selection.main
    const nextSelection = resetSelection
      ? EditorSelection.cursor(0)
      : EditorSelection.range(
        Math.min(currentSelection.anchor, storeContent.length),
        Math.min(currentSelection.head, storeContent.length),
      )

    editorView.dispatch({
      changes: {
        from: 0,
        to: currentContent.length,
        insert: storeContent,
      },
      selection: nextSelection,
      annotations: storeSyncAnnotation.of(true),
    })
  }

  function syncEditorModeFromStore() {
    if (!editorView) return

    editorView.dispatch({
      effects: editorModeCompartment.reconfigure(
        buildModeExtensions(documentStore.editorMode),
      ),
    })
  }

  async function handleGlobalKeyDown(event: KeyboardEvent) {
    const isMod = event.metaKey || event.ctrlKey
    if (!isMod) return

    const key = event.key.toLowerCase()

    if (key === 'o') {
      event.preventDefault()
      try {
        await documentStore.openFileDialog()
      } catch (error) {
        console.error('Failed to open file:', error)
      }
      return
    }

    if (key === 's') {
      event.preventDefault()
      try {
        if (event.shiftKey) {
          await documentStore.saveFileAs()
        } else if (documentStore.currentFile?.path) {
          await documentStore.saveFile()
        } else {
          await documentStore.saveFileAs()
        }
      } catch (error) {
        console.error('Failed to save file:', error)
      }
      return
    }

    if (key === 'n') {
      event.preventDefault()
      documentStore.newFile()
    }
  }

  watch(
    () => hasOpenFile.value,
    async (isOpen) => {
      if (!isOpen) {
        destroyEditor()
        return
      }

      await nextTick()
      createEditor(documentStore.currentFile?.content ?? '')
    },
    { immediate: true },
  )

  watch(
    () => documentStore.activeDocumentId,
    () => {
      syncEditorFromStore(true)
      syncEditorModeFromStore()
    },
  )

  watch(
    () => documentStore.currentFile?.content,
    () => {
      syncEditorFromStore(false)
    },
  )

  watch(
    () => documentStore.editorMode,
    () => {
      syncEditorModeFromStore()
    },
  )

  onMounted(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
    documentStore.loadRecentFiles()

    removeEditorCommandListener = addEditorCommandListener(({ command }) => {
      if (!editorView) return
      runEditorCommand(editorView, command)
    })
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleGlobalKeyDown)
    removeEditorCommandListener?.()
    removeEditorCommandListener = null
    destroyEditor()
  })

  return {
    editorHost,
    hasOpenFile,
    isRenderedMode,
  }
}
