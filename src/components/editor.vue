<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'

const editor = useEditor({
  content: '<p>Start typing here...</p>',
  extensions: [StarterKit],
})
</script>

<template>
  <div class="simple-editor">
    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<style scoped>
.simple-editor {
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
.editor-content :deep(.tiptap h3) {
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

.editor-content :deep(.tiptap ul),
.editor-content :deep(.tiptap ol) {
  padding-left: 1.5em;
  margin: 0 0 1em 0;
}

.editor-content :deep(.tiptap blockquote) {
  border-left: 3px solid rgba(255, 255, 255, 0.3);
  padding-left: 1em;
  margin: 1em 0;
  opacity: 0.8;
}

.editor-content :deep(.tiptap code) {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.9em;
}

.editor-content :deep(.tiptap pre) {
  background: rgba(0, 0, 0, 0.3);
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1em 0;
}

.editor-content :deep(.tiptap pre code) {
  background: none;
  padding: 0;
}

.editor-content :deep(.tiptap hr) {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  margin: 2em 0;
}
</style>

