<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWorkspaceStore, type FileEntry } from '../../stores/workspaceStore'
import { useDocumentStore } from '../../stores/documentStore'
import FileTreeItem from './FileTreeItem.vue'

const workspaceStore = useWorkspaceStore()
const documentStore = useDocumentStore()

const contextMenu = ref<{
  visible: boolean
  x: number
  y: number
  entry: FileEntry | null
}>({
  visible: false,
  x: 0,
  y: 0,
  entry: null,
})

const isCreating = ref<{
  type: 'file' | 'folder' | null
  parentPath: string | null
}>({
  type: null,
  parentPath: null,
})

const newItemName = ref('')

const hasWorkspace = computed(() => workspaceStore.hasWorkspace)
const entries = computed(() => workspaceStore.entries)
const hasUnsavedChanges = computed(() => documentStore.hasUnsavedChanges)
const hasOpenFile = computed(() => documentStore.activeDocument !== null)
const isSaving = computed(() => documentStore.isSaving)

async function handleOpenFolder() {
  await workspaceStore.openFolder()
}

async function handleOpenFile() {
  try {
    await documentStore.openFileDialog()
  } catch (error) {
    console.error('Failed to open file:', error)
  }
}

async function handleSaveFile() {
  try {
    if (documentStore.activeDocument?.path) {
      await documentStore.saveFile()
    } else {
      await documentStore.saveFileAs()
    }
  } catch (error) {
    console.error('Failed to save file:', error)
  }
}

function handleNewFile() {
  documentStore.newFile()
}

async function handleFileClick(entry: FileEntry) {
  if (entry.is_dir) {
    workspaceStore.toggleFolder(entry.path)
  } else if (entry.is_markdown) {
    await documentStore.openFileFromPath(entry.path)
  }
}

function handleContextMenu(event: MouseEvent, entry: FileEntry) {
  event.preventDefault()
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    entry,
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false
  contextMenu.value.entry = null
}

function startCreateFile(parentPath: string) {
  isCreating.value = { type: 'file', parentPath }
  newItemName.value = ''
  closeContextMenu()
}

function startCreateFolder(parentPath: string) {
  isCreating.value = { type: 'folder', parentPath }
  newItemName.value = ''
  closeContextMenu()
}

async function confirmCreate() {
  if (!isCreating.value.type || !isCreating.value.parentPath || !newItemName.value.trim()) {
    cancelCreate()
    return
  }

  try {
    let name = newItemName.value.trim()
    
    if (isCreating.value.type === 'file') {
      // Ensure .md extension
      if (!name.endsWith('.md')) {
        name += '.md'
      }
      const entry = await workspaceStore.createFile(isCreating.value.parentPath, name)
      if (entry) {
        await documentStore.openFileFromPath(entry.path)
      }
    } else {
      await workspaceStore.createFolder(isCreating.value.parentPath, name)
    }
  } catch (error) {
    console.error('Failed to create:', error)
  }

  cancelCreate()
}

function cancelCreate() {
  isCreating.value = { type: null, parentPath: null }
  newItemName.value = ''
}

async function handleDelete(entry: FileEntry) {
  const confirmed = confirm(`Are you sure you want to delete "${entry.name}"?`)
  if (!confirmed) return

  try {
    // Close document if open
    const doc = documentStore.findDocumentByPath(entry.path)
    if (doc) {
      await documentStore.closeDocument(doc.id, true)
    }
    
    await workspaceStore.deleteItem(entry.path)
  } catch (error) {
    console.error('Failed to delete:', error)
  }
  
  closeContextMenu()
}

function handleRename(_entry: FileEntry) {
  // This will be handled by FileTreeItem
  closeContextMenu()
}

// Close context menu on click outside
function handleDocumentClick(_event: MouseEvent) {
  if (contextMenu.value.visible) {
    closeContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  // Try to restore previous workspace
  workspaceStore.restoreWorkspace()
})
</script>

<template>
  <div class="file-tree">
    <!-- Workspace header -->
    <div class="workspace-header">
      <span v-if="hasWorkspace" class="workspace-name">{{ workspaceStore.rootName }}</span>
      <span v-else class="workspace-name placeholder">No folder open</span>
      <div class="workspace-actions">
        <button 
          class="workspace-action" 
          @click="handleNewFile"
          title="New File (⌘N)"
        >
          <i class="pi pi-plus"></i>
        </button>
        <button 
          class="workspace-action" 
          @click="handleOpenFile"
          title="Open File (⌘O)"
        >
          <i class="pi pi-file"></i>
        </button>
        <button 
          class="workspace-action" 
          @click="handleOpenFolder"
          title="Open Folder (⌘⇧O)"
        >
          <i class="pi pi-folder-open"></i>
        </button>
        <button 
          class="workspace-action"
          :class="{ 'has-changes': hasUnsavedChanges }"
          :disabled="(!hasOpenFile && !hasUnsavedChanges) || isSaving"
          @click="handleSaveFile"
          title="Save (⌘S)"
        >
          <i class="pi pi-save"></i>
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!hasWorkspace" class="empty-state">
      <p>Open a folder to browse files</p>
    </div>

    <!-- File tree -->
    <ul v-else class="tree-list" role="tree">
      <FileTreeItem
        v-for="entry in entries"
        :key="entry.path"
        :entry="entry"
        :level="0"
        :is-expanded="workspaceStore.isExpanded(entry.path)"
        :active-path="documentStore.currentFilePath"
        @click="handleFileClick"
        @context-menu="handleContextMenu"
        @toggle="workspaceStore.toggleFolder"
      />
    </ul>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      >
        <template v-if="contextMenu.entry?.is_dir">
          <button @click="startCreateFile(contextMenu.entry!.path)">
            <i class="pi pi-file"></i> New File
          </button>
          <button @click="startCreateFolder(contextMenu.entry!.path)">
            <i class="pi pi-folder"></i> New Folder
          </button>
          <div class="separator"></div>
        </template>
        <button @click="handleRename(contextMenu.entry!)">
          <i class="pi pi-pencil"></i> Rename
        </button>
        <button class="danger" @click="handleDelete(contextMenu.entry!)">
          <i class="pi pi-trash"></i> Delete
        </button>
      </div>
    </Teleport>

    <!-- Create dialog -->
    <div v-if="isCreating.type" class="create-dialog">
      <input
        v-model="newItemName"
        type="text"
        :placeholder="isCreating.type === 'file' ? 'filename.md' : 'folder name'"
        @keyup.enter="confirmCreate"
        @keyup.escape="cancelCreate"
        autofocus
      />
      <div class="create-actions">
        <button @click="cancelCreate">Cancel</button>
        <button class="primary" @click="confirmCreate">Create</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 0.875rem;
}

.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 0.5rem;
}

.workspace-name {
  flex: 1;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.workspace-name.placeholder {
  font-weight: 400;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}

.workspace-actions {
  display: flex;
  gap: 0.125rem;
  flex-shrink: 0;
}

.workspace-action {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.workspace-action:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.workspace-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.workspace-action.has-changes {
  color: var(--tt-brand-color-500);
}

.workspace-action.has-changes:hover:not(:disabled) {
  background: rgba(var(--tt-brand-color-rgb, 98, 41, 255), 0.2);
}

.workspace-action .pi {
  font-size: 0.875rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
}

.empty-state p {
  margin: 0;
  font-size: 0.8125rem;
}

.tree-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

/* Context menu */
.context-menu {
  position: fixed;
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0.25rem;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.context-menu button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.875rem;
  text-align: left;
}

.context-menu button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.context-menu button.danger {
  color: #ff6b6b;
}

.context-menu button.danger:hover {
  background: rgba(255, 107, 107, 0.2);
}

.context-menu .separator {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0.25rem 0;
}

/* Create dialog */
.create-dialog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem;
  min-width: 250px;
  z-index: 1000;
}

.create-dialog input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: white;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.create-dialog input:focus {
  outline: none;
  border-color: var(--tt-brand-color-500);
}

.create-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.create-actions button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
}

.create-actions button:first-child {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.create-actions button.primary {
  background: var(--tt-brand-color-500);
  color: white;
}
</style>
