<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
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
import EditorToolbar from './EditorToolbar.vue'

import content from '../../data/content.json'

interface Props {
  sidebarOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  sidebarOpen: true
})

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'hover-sidebar', hovering: boolean): void
}>()

const editor = useEditor({
  content,
  extensions: [
    StarterKit.configure({
      // Disable default heading if we want custom levels
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
  ],
})
</script>

<template>
  <div class="editor-container">
    <EditorToolbar
      :editor="editor"
      :sidebar-open="props.sidebarOpen"
      @toggle-sidebar="emit('toggle-sidebar')"
      @hover-sidebar="emit('hover-sidebar', $event)"
    />
    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<style scoped>
.editor-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--tt-bg-color);
  overflow: hidden;
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
  border-top: 1px solid var(--tt-border-color);
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
</style>

