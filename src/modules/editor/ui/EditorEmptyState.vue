<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentStore } from '../state/documentStore'
import { formatShortcutForDisplay } from '../../settings/shortcuts/shortcutRegistry'
import { useSettingsStore } from '../../settings/state/settingsStore'
import { useWorkspaceStore } from '../../workspace/state/workspaceStore'
import { isMacPlatform } from '../../../shared/platform/runtime'

const documentStore = useDocumentStore()
const settingsStore = useSettingsStore()
const workspaceStore = useWorkspaceStore()

const isMac = isMacPlatform()

const shortcutHints = computed(() => ({
  openFolder: formatShortcutForDisplay(settingsStore.shortcuts.open_folder, isMac),
  openFile: formatShortcutForDisplay(settingsStore.shortcuts.open_file, isMac),
  newFile: formatShortcutForDisplay(settingsStore.shortcuts.new_file, isMac),
}))
</script>

<template>
  <div class="empty-state">
    <div class="empty-state-content">
      <span class="material-symbols-outlined empty-icon">description</span>
      <h2>No file open</h2>
      <p>Open a markdown file to start editing</p>

      <div class="empty-state-actions">
        <button
          class="empty-action-btn secondary"
          @click="workspaceStore.openFolder()"
          title="Open Folder"
        >
          <span class="material-symbols-outlined">folder</span>
          Open Folder
        </button>
        <button
          class="empty-action-btn secondary"
          @click="documentStore.openFileDialog()"
          title="Open File"
        >
          <span class="material-symbols-outlined">description</span>
          Open File
        </button>
        <button class="empty-action-btn" @click="documentStore.newFile()" title="New File">
          <span class="material-symbols-outlined">add</span>
          New File
        </button>
      </div>

      <div class="shortcut-row">
        <span class="shortcut-item"><kbd>{{ shortcutHints.openFolder }}</kbd> Folder</span>
        <span class="shortcut-item"><kbd>{{ shortcutHints.openFile }}</kbd> File</span>
        <span class="shortcut-item"><kbd>{{ shortcutHints.newFile }}</kbd> New</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state-content {
  text-align: center;
  color: var(--tt-gray-light-500);
  max-width: 560px;
  padding: 0 20px;
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
  margin: 0 0 10px;
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
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 26px;
}

.empty-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 136px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: var(--tt-brand-color-500);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.empty-action-btn.secondary {
  background: var(--tt-gray-light-200);
  color: var(--tt-gray-light-700);
}

.dark .empty-action-btn.secondary {
  background: var(--tt-gray-dark-200);
  color: var(--tt-gray-dark-700);
}

.shortcut-row {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.shortcut-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 136px;
  font-size: 11px;
  color: var(--tt-gray-light-500);
}

.dark .shortcut-item {
  color: var(--tt-gray-dark-500);
}

.shortcut-item kbd {
  display: inline-block;
  padding: 2px 6px;
  border: 1px solid var(--tt-gray-light-300);
  border-radius: 4px;
  background: var(--tt-gray-light-100);
  font-size: 11px;
}

.dark .shortcut-item kbd {
  border-color: var(--tt-gray-dark-400);
  background: var(--tt-gray-dark-200);
}
</style>
