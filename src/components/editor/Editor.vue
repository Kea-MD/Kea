<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { watch, computed, onMounted, onUnmounted } from 'vue'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Markdown } from 'tiptap-markdown'
import { EditorState } from '@tiptap/pm/state'
import { useDocumentStore } from '../../stores/documentStore'
import { preprocessMarkdown } from '../../utils/markdown'
import { useAutoSave } from '../../composables/useAutoSave'

const documentStore = useDocumentStore()

// Enable auto-save (2 second debounce)
useAutoSave(2000)

// Check if a file is currently open
const hasOpenFile = computed(() => documentStore.currentFile !== null)

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4],
      },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'editor-link',
      },
    }),
    Image.configure({
      HTMLAttributes: {
        class: 'editor-image',
      },
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Color,
    TextStyle,
    Placeholder.configure({
      placeholder: 'Start writing...',
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Subscript,
    Superscript,
    Markdown.configure({
      html: false,
      tightLists: true,
      bulletListMarker: '-',
      breaks: false,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ],
  onUpdate: ({ editor }) => {
    // Get markdown content from editor and update store
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markdown = (editor.storage as any).markdown.getMarkdown()
    documentStore.updateContent(markdown)
  },
})

// Watch for active document changes and update editor content
watch(
  () => documentStore.activeDocument,
  (newDoc, oldDoc) => {
    if (!editor.value) return
    
    // Only update if it's a different document (not just content change)
    if (newDoc?.id !== oldDoc?.id) {
      const editorInstance = editor.value
      
      let content = ''
      if (newDoc) {
        content = preprocessMarkdown(newDoc.content)
      }
      
      // Set content without emitting update to prevent triggering save
      editorInstance.commands.setContent(content, { emitUpdate: false })
      
      // Create a fresh editor state to clear undo/redo history
      // This replaces the current state with a new one that has no history
      const newState = EditorState.create({
        doc: editorInstance.state.doc,
        plugins: editorInstance.state.plugins,
        selection: editorInstance.state.selection,
      })
      editorInstance.view.updateState(newState)
    }
  },
  { immediate: true }
)

// Keyboard shortcuts
const handleKeyDown = async (e: KeyboardEvent) => {
  // Cmd+O / Ctrl+O - Open file
  if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
    e.preventDefault()
    try {
      await documentStore.openFileDialog()
    } catch (error) {
      console.error('Failed to open file:', error)
    }
  }

  // Cmd+S / Ctrl+S - Save file
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    if (e.shiftKey) {
      // Save As
      try {
        await documentStore.saveFileAs()
      } catch (error) {
        console.error('Failed to save file as:', error)
      }
    } else {
      // Save
      if (documentStore.currentFile?.path) {
        try {
          await documentStore.saveFile()
        } catch (error) {
          console.error('Failed to save file:', error)
        }
      } else {
        // No path yet, do Save As
        try {
          await documentStore.saveFileAs()
        } catch (error) {
          console.error('Failed to save file as:', error)
        }
      }
    }
  }

  // Cmd+N / Ctrl+N - New file
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    e.preventDefault()
    documentStore.newFile()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  // Load recent files from localStorage
  documentStore.loadRecentFiles()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

// Expose editor for parent component
defineExpose({
  editor
})
</script>

<template>
  <div class="editor-container">
    <!-- Empty state when no file is open -->
    <Transition name="fade">
      <div v-if="!hasOpenFile" class="empty-state">
        <div class="empty-state-content">
          <span class="material-symbols-outlined empty-icon">description</span>
          <h2>No file open</h2>
          <p>Open a markdown file to start editing</p>
          <div class="empty-state-actions">
            <button class="empty-action-btn" @click="documentStore.openFileDialog()">
              <span class="material-symbols-outlined">folder_open</span>
              Open File
            </button>
            <button class="empty-action-btn secondary" @click="documentStore.newFile()">
              <span class="material-symbols-outlined">add</span>
              New File
            </button>
          </div>
          <p class="shortcut-hint">
            <kbd>⌘O</kbd> to open &nbsp;•&nbsp; <kbd>⌘N</kbd> to create new
          </p>
        </div>
      </div>
    </Transition>
    
    <!-- Editor content - always rendered but visibility controlled -->
    <EditorContent :editor="editor" class="editor-content" :class="{ 'is-hidden': !hasOpenFile }" />
  </div>
</template>

<style scoped>
.editor-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-content {
  flex: 1;
  overflow-y: auto;
}

/* Tiptap editor styling */
.editor-content :deep(.tiptap) {
  height: 100%;
  padding: 20px 40px;
  outline: none;
  font-size: 16px;
  line-height: 1.7;
}

.editor-content :deep(.tiptap p) {
  margin: 0 0 1em 0;
}

.editor-content :deep(.tiptap h1),
.editor-content :deep(.tiptap h2),
.editor-content :deep(.tiptap h3),
.editor-content :deep(.tiptap h4) {
  margin: 1.5em 0 0.5em 0;
  font-weight: 600;
}

.editor-content :deep(.tiptap h1) {
  font-size: 2em;
}

.editor-content :deep(.tiptap h2) {
  font-size: 1.5em;
}

.editor-content :deep(.tiptap h3) {
  font-size: 1.25em;
}

.editor-content :deep(.tiptap h4) {
  font-size: 1.1em;
}

.editor-content :deep(.tiptap ul),
.editor-content :deep(.tiptap ol) {
  padding-left: 1.5em;
  margin: 0 0 1em 0;
}

.editor-content :deep(.tiptap blockquote) {
  border-left: 3px solid var(--tt-brand-color-400);
  padding-left: 1em;
  margin: 1em 0;
  opacity: 0.9;
}

.editor-content :deep(.tiptap code) {
  background: var(--tt-gray-light-a-100);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.9em;
}

.dark .editor-content :deep(.tiptap code) {
  background: var(--tt-gray-dark-a-200);
}

.editor-content :deep(.tiptap pre) {
  background: var(--tt-gray-light-100);
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1em 0;
}

.dark .editor-content :deep(.tiptap pre) {
  background: var(--tt-gray-dark-200);
}

.editor-content :deep(.tiptap pre code) {
  background: none;
  padding: 0;
}

.editor-content :deep(.tiptap hr) {
  border: none;
  border-top: 1px solid var(--tt-gray-light-a-200);
  margin: 2em 0;
}

/* Link styling */
.editor-content :deep(.tiptap a),
.editor-content :deep(.tiptap .editor-link) {
  color: var(--tt-brand-color-500);
  text-decoration: underline;
  cursor: pointer;
}

.editor-content :deep(.tiptap a:hover),


.editor-content :deep(.tiptap .editor-link:hover) {
  color: var(--tt-brand-color-400);
}

/* Image styling */
.editor-content :deep(.tiptap img),
.editor-content :deep(.tiptap .editor-image) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1em 0;
}

.editor-content :deep(.tiptap img.ProseMirror-selectednode) {
  outline: 2px solid var(--tt-brand-color-500);
}

/* Task list styling */
.editor-content :deep(.tiptap ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
}

.editor-content :deep(.tiptap ul[data-type="taskList"] li) {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
  margin-bottom: 0.5em;
}

.editor-content :deep(.tiptap ul[data-type="taskList"] li > label) {
  flex-shrink: 0;
  margin-top: 0.25em;
}

.editor-content :deep(.tiptap ul[data-type="taskList"] li > label input[type="checkbox"]) {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--tt-brand-color-500);
}

.editor-content :deep(.tiptap ul[data-type="taskList"] li > div) {
  flex: 1;
}

.editor-content :deep(.tiptap ul[data-type="taskList"] li[data-checked="true"] > div) {
  text-decoration: line-through;
  opacity: 0.6;
}

/* Placeholder styling */
.editor-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--tt-gray-light-400);
  pointer-events: none;
  height: 0;
}

.dark .editor-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  color: var(--tt-gray-dark-400);
}

/* Text alignment */
.editor-content :deep(.tiptap [style*="text-align: center"]) {
  text-align: center;
}

.editor-content :deep(.tiptap [style*="text-align: right"]) {
  text-align: right;
}

.editor-content :deep(.tiptap [style*="text-align: justify"]) {
  text-align: justify;
}

/* Highlight colors */
.editor-content :deep(.tiptap mark) {
  border-radius: 2px;
  padding: 0.1em 0.2em;
}

/* Strike through */
.editor-content :deep(.tiptap s) {
  text-decoration: line-through;
}

/* Underline */
.editor-content :deep(.tiptap u) {
  text-decoration: underline;
}

/* Empty state styling */
.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  overflow: hidden;
}

/* Fade transition for empty state */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Hidden state for editor content */
.editor-content.is-hidden {
  visibility: hidden;
  pointer-events: none;
}

.empty-state-content {
  text-align: center;
  color: var(--tt-gray-light-500);
}

.dark .empty-state-content {
  color: var(--tt-gray-dark-400);
}

.empty-icon {
  font-size: 64px;
  opacity: 0.5;
  margin-bottom: 16px;
}

.empty-state h2 {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 500;
}

.empty-state p {
  margin: 0;
  opacity: 0.8;
}

.empty-state-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 24px;
}

.empty-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: var(--tt-brand-color-500);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.empty-action-btn:hover {
  background: var(--tt-brand-color-600);
}

.empty-action-btn.secondary {
  background: var(--tt-gray-light-200);
  color: var(--tt-gray-light-700);
}

.empty-action-btn.secondary:hover {
  background: var(--tt-gray-light-300);
}

.dark .empty-action-btn.secondary {
  background: var(--tt-gray-dark-200);
  color: var(--tt-gray-dark-700);
}

.dark .empty-action-btn.secondary:hover {
  background: var(--tt-gray-dark-300);
}

.empty-action-btn .material-symbols-outlined {
  font-size: 18px;
}

.shortcut-hint {
  margin-top: 24px !important;
  font-size: 12px;
  opacity: 0.6;
}

.shortcut-hint kbd {
  display: inline-block;
  padding: 2px 6px;
  background: var(--tt-gray-light-100);
  border: 1px solid var(--tt-gray-light-300);
  border-radius: 4px;
  font-family: inherit;
  font-size: 11px;
}

.dark .shortcut-hint kbd {
  background: var(--tt-gray-dark-200);
  border-color: var(--tt-gray-dark-400);
}
</style>

