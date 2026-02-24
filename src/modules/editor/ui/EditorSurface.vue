<script setup lang="ts">
import { useAutoSave } from '../runtime/useAutoSave'
import { useEditorRuntime } from '../runtime/useEditorRuntime'
import { useDocumentStore } from '../state/documentStore'

const documentStore = useDocumentStore()

useAutoSave(2000)

const {
  editorHost,
  hasOpenFile,
  isRenderedMode,
} = useEditorRuntime(documentStore)
</script>

<template>
  <div class="editor-container">
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

    <div v-if="hasOpenFile" class="editor-layout">
      <div
        ref="editorHost"
        class="codemirror-host"
        :class="{ 'is-rendered-mode': isRenderedMode }"
      />
    </div>
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

.editor-layout,
.codemirror-host,
.codemirror-host :deep(.cm-editor) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.editor-layout {
  flex: 1;
}

.codemirror-host :deep(.cm-scroller) {
  height: 100%;
  min-height: 0;
  overflow: auto;
  font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
  line-height: 1.7;
}

.codemirror-host.is-rendered-mode :deep(.cm-scroller),
.codemirror-host :deep(.cm-rendered-markdown-block) {
  font-family: Roboto, sans-serif;
}

.codemirror-host :deep(.cm-content) {
  min-height: 100%;
  padding: 0 40px 20px;
  color: var(--tt-gray-light-700);
}

.dark .codemirror-host :deep(.cm-content) {
  color: var(--tt-gray-dark-700);
}

.codemirror-host :deep(.cm-gutters) {
  background: transparent;
  border-right: none;
}

.codemirror-host.is-rendered-mode :deep(.cm-gutters) {
  display: none;
}

.codemirror-host :deep(.cm-rendered-markdown-block) {
  padding: 4px 2px;
  border-radius: 6px;
  cursor: text;
}

.codemirror-host :deep(.cm-rendered-markdown-block:hover) {
  background: var(--tt-gray-light-a-100);
}

.dark .codemirror-host :deep(.cm-rendered-markdown-block:hover) {
  background: var(--tt-gray-dark-a-100);
}

.codemirror-host :deep(.cm-rendered-markdown-block :is(h1, h2, h3, p, ul, ol, blockquote, pre, table)) {
  margin: 0.45em 0;
}

.codemirror-host :deep(.cm-rendered-markdown-block pre) {
  padding: 0.7em 0.85em;
  border-radius: 8px;
  overflow-x: auto;
  background: var(--tt-gray-light-100);
}

.dark .codemirror-host :deep(.cm-rendered-markdown-block pre) {
  background: var(--tt-gray-dark-100);
}

.codemirror-host :deep(.cm-rendered-markdown-block code) {
  font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
  font-size: 0.92em;
  border-radius: 4px;
  padding: 0.1em 0.28em;
  background: var(--tt-gray-light-a-100);
}

.dark .codemirror-host :deep(.cm-rendered-markdown-block code) {
  background: var(--tt-gray-dark-a-100);
}

.codemirror-host :deep(.cm-rendered-markdown-block pre code) {
  padding: 0;
  background: transparent;
}

.codemirror-host :deep(.cm-rendered-markdown-block blockquote) {
  margin-left: 0;
  padding-left: 0.8em;
  border-left: 3px solid var(--tt-gray-light-a-300);
}

.dark .codemirror-host :deep(.cm-rendered-markdown-block blockquote) {
  border-left-color: var(--tt-gray-dark-a-300);
}

.codemirror-host :deep(.cm-rendered-markdown-block table) {
  width: 100%;
  border-collapse: collapse;
}

.codemirror-host :deep(.cm-rendered-markdown-block th),
.codemirror-host :deep(.cm-rendered-markdown-block td) {
  border: 1px solid var(--tt-gray-light-a-200);
  padding: 0.33em 0.55em;
  text-align: left;
}

.dark .codemirror-host :deep(.cm-rendered-markdown-block th),
.dark .codemirror-host :deep(.cm-rendered-markdown-block td) {
  border-color: var(--tt-gray-dark-a-200);
}

.codemirror-host :deep(.cm-rendered-markdown-block img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

.codemirror-host :deep(.cm-rendered-markdown-block a) {
  color: var(--tt-brand-color-500);
}

.codemirror-host :deep(.cm-panels) {
  border-bottom: 1px solid var(--tt-gray-light-a-200);
  background: var(--tt-gray-light-100);
}

.dark .codemirror-host :deep(.cm-panels) {
  border-bottom-color: var(--tt-gray-dark-a-200);
  background: var(--tt-gray-dark-100);
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
  margin: 0 0 8px;
  font-size: 1.5rem;
  font-weight: 500;
}

.empty-state p {
  margin: 0;
  opacity: 0.85;
}

.empty-state-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}

.empty-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: var(--tt-brand-color-500);
  color: #fff;
}

.empty-action-btn.secondary {
  background: var(--tt-gray-light-200);
  color: var(--tt-gray-light-700);
}

.dark .empty-action-btn.secondary {
  background: var(--tt-gray-dark-200);
  color: var(--tt-gray-dark-700);
}

.shortcut-hint {
  margin-top: 24px;
  font-size: 12px;
  opacity: 0.65;
}

.shortcut-hint kbd {
  display: inline-block;
  padding: 2px 6px;
  border: 1px solid var(--tt-gray-light-300);
  border-radius: 4px;
  background: var(--tt-gray-light-100);
  font-size: 11px;
}

.dark .shortcut-hint kbd {
  border-color: var(--tt-gray-dark-400);
  background: var(--tt-gray-dark-200);
}
</style>
