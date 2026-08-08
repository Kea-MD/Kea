<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useWorkspaceStore, type FileEntry } from '../state/workspaceStore'
import { useDocumentStore, type OpenDocument } from '../../editor/state/documentStore'
import { useSettingsStore } from '../../settings/state/settingsStore'
import FileTreeItem from './FileTreeItem.vue'

const workspaceStore = useWorkspaceStore()
const documentStore = useDocumentStore()
const settingsStore = useSettingsStore()

function logDragEvent(message: string, details?: Record<string, unknown>) {
  console.log('[Sidebar DnD][Tree]', message, details ?? {})
}

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

const renamePath = ref<string | null>(null)
const treeListRef = ref<HTMLElement | null>(null)
const dragState = ref<{
  sourcePath: string | null
  dropTargetPath: string | null
  isOverRoot: boolean
  startX: number
  startY: number
  hasMoved: boolean
}>({
  sourcePath: null,
  dropTargetPath: null,
  isOverRoot: false,
  startX: 0,
  startY: 0,
  hasMoved: false,
})

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

function triggerRename(path: string) {
  renamePath.value = path
  nextTick(() => {
    renamePath.value = null
  })
}

function resetDragState() {
  logDragEvent('Reset drag state', {
    sourcePath: dragState.value.sourcePath,
    dropTargetPath: dragState.value.dropTargetPath,
    isOverRoot: dragState.value.isOverRoot,
  })
  dragState.value.sourcePath = null
  dragState.value.dropTargetPath = null
  dragState.value.isOverRoot = false
  dragState.value.startX = 0
  dragState.value.startY = 0
  dragState.value.hasMoved = false
}

function getNextUntitledName(parentPath: string, type: 'file' | 'folder'): string {
  const parent = workspaceStore.findEntry(parentPath)
  const existingNames = new Set(
    (parent?.children ?? []).map(child => child.name.toLowerCase())
  )

  const fileExtension = '.md'
  const baseName = type === 'file' ? `untitled${fileExtension}` : 'untitled'

  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName
  }

  let index = 1
  while (true) {
    const candidate = type === 'file'
      ? `untitled-${index}${fileExtension}`
      : `untitled-${index}`

    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate
    }

    index += 1
  }
}

async function createAndRename(parentPath: string, type: 'file' | 'folder') {
  closeContextMenu()

  try {
    const name = getNextUntitledName(parentPath, type)
    const entry = type === 'file'
      ? await workspaceStore.createFile(parentPath, name)
      : await workspaceStore.createFolder(parentPath, name)

    if (entry) {
      triggerRename(entry.path)
    }
  } catch (error) {
    console.error(`Failed to create ${type}:`, error)
  }
}

function startCreateFile(parentPath: string) {
  void createAndRename(parentPath, 'file')
}

function startCreateFolder(parentPath: string) {
  void createAndRename(parentPath, 'folder')
}

function pathMatches(path: string, targetPath: string, isDirectory: boolean): boolean {
  if (path === targetPath) return true
  if (!isDirectory) return false
  return path.startsWith(`${targetPath}/`) || path.startsWith(`${targetPath}\\`)
}

function canDropInto(targetDir: string): boolean {
  const sourcePath = dragState.value.sourcePath
  if (!sourcePath || !workspaceStore.rootPath) {
    logDragEvent('Drop rejected: missing source or workspace root', {
      sourcePath,
      rootPath: workspaceStore.rootPath,
      targetDir,
    })
    return false
  }

  if (sourcePath === workspaceStore.rootPath || sourcePath === targetDir) {
    logDragEvent('Drop rejected: source is root or same as target', {
      sourcePath,
      targetDir,
      rootPath: workspaceStore.rootPath,
    })
    return false
  }

  const sourceEntry = workspaceStore.findEntry(sourcePath)
  if (!sourceEntry) {
    logDragEvent('Drop rejected: source entry not found in tree', {
      sourcePath,
      targetDir,
    })
    return false
  }

  if (workspaceStore.getParentPath(sourcePath) === targetDir) {
    logDragEvent('Drop rejected: source already in target directory', {
      sourcePath,
      targetDir,
    })
    return false
  }

  if (sourceEntry.is_dir && pathMatches(targetDir, sourcePath, true)) {
    logDragEvent('Drop rejected: cannot move folder into itself/descendant', {
      sourcePath,
      targetDir,
    })
    return false
  }

  logDragEvent('Drop allowed', {
    sourcePath,
    targetDir,
    sourceIsDirectory: sourceEntry.is_dir,
  })
  return true
}

function handleDragStart(entry: FileEntry) {
  logDragEvent('Drag start received from item', {
    sourcePath: entry.path,
    isDirectory: entry.is_dir,
  })
  dragState.value.sourcePath = entry.path
  dragState.value.dropTargetPath = null
  dragState.value.isOverRoot = false
}

async function moveDraggedItem(targetDir: string) {
  const sourcePath = dragState.value.sourcePath
  if (!sourcePath) {
    logDragEvent('Move aborted: no source path set', { targetDir })
    resetDragState()
    return
  }

  const sourceEntry = workspaceStore.findEntry(sourcePath)
  if (!sourceEntry) {
    logDragEvent('Move aborted: source entry missing before move', {
      sourcePath,
      targetDir,
    })
    resetDragState()
    return
  }

  const isDirectory = sourceEntry.is_dir

  try {
    logDragEvent('Attempting move', {
      sourcePath,
      targetDir,
      sourceIsDirectory: isDirectory,
    })
    const newPath = await workspaceStore.moveItem(sourcePath, targetDir)
    if (newPath) {
      logDragEvent('Move succeeded', {
        sourcePath,
        targetDir,
        newPath,
      })
      documentStore.updatePathsAfterRename(sourcePath, newPath, isDirectory)
    } else {
      logDragEvent('Move returned null (store rejected move)', {
        sourcePath,
        targetDir,
      })
    }
  } catch (error) {
    console.error('Failed to move item:', error, {
      sourcePath,
      targetDir,
    })
  }

  resetDragState()
}

function handleDropOnFolder(entry: FileEntry) {
  logDragEvent('Drop on folder requested', {
    targetPath: entry.path,
    sourcePath: dragState.value.sourcePath,
  })
  if (!canDropInto(entry.path)) {
    resetDragState()
    return
  }

  void moveDraggedItem(entry.path)
}

function suppressNextClick() {
  const handler = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  document.addEventListener('click', handler, true)
  setTimeout(() => {
    document.removeEventListener('click', handler, true)
  }, 0)
}

function clearPointerDragListeners() {
  document.removeEventListener('mousemove', handlePointerDragMove)
  document.removeEventListener('mouseup', handlePointerDragEnd)
}

function findFolderTargetFromPoint(clientX: number, clientY: number): FileEntry | null {
  const element = document.elementFromPoint(clientX, clientY)
  if (!(element instanceof Element)) {
    return null
  }

  const folderElement = element.closest<HTMLElement>('[data-entry-path][data-entry-dir="true"]')
  const folderPath = folderElement?.dataset.entryPath
  if (!folderPath) {
    return null
  }

  const entry = workspaceStore.findEntry(folderPath)
  if (!entry || !entry.is_dir) {
    return null
  }

  return entry
}

function updatePointerDropTarget(clientX: number, clientY: number) {
  const folderTarget = findFolderTargetFromPoint(clientX, clientY)
  if (folderTarget) {
    if (canDropInto(folderTarget.path)) {
      dragState.value.dropTargetPath = folderTarget.path
      dragState.value.isOverRoot = false
      logDragEvent('Pointer over folder target', {
        sourcePath: dragState.value.sourcePath,
        targetPath: folderTarget.path,
      })
      return
    }

    dragState.value.dropTargetPath = null
    dragState.value.isOverRoot = false
    logDragEvent('Pointer over invalid folder target', {
      sourcePath: dragState.value.sourcePath,
      targetPath: folderTarget.path,
    })
    return
  }

  dragState.value.dropTargetPath = null

  if (!workspaceStore.rootPath || !treeListRef.value) {
    dragState.value.isOverRoot = false
    return
  }

  const element = document.elementFromPoint(clientX, clientY)
  const isInsideTree = element instanceof Node ? treeListRef.value.contains(element) : false
  dragState.value.isOverRoot = isInsideTree ? canDropInto(workspaceStore.rootPath) : false

  if (dragState.value.isOverRoot) {
    logDragEvent('Pointer over workspace root drop zone', {
      sourcePath: dragState.value.sourcePath,
      rootPath: workspaceStore.rootPath,
    })
  }
}

function handlePointerDragMove(event: MouseEvent) {
  const sourcePath = dragState.value.sourcePath
  if (!sourcePath) {
    return
  }

  const distanceX = Math.abs(event.clientX - dragState.value.startX)
  const distanceY = Math.abs(event.clientY - dragState.value.startY)
  if (!dragState.value.hasMoved) {
    if (distanceX < 4 && distanceY < 4) {
      return
    }

    dragState.value.hasMoved = true
    logDragEvent('Pointer drag threshold crossed', {
      sourcePath,
      distanceX,
      distanceY,
    })
  }

  event.preventDefault()
  updatePointerDropTarget(event.clientX, event.clientY)
}

function handlePointerDragEnd(event: MouseEvent) {
  clearPointerDragListeners()

  if (!dragState.value.sourcePath) {
    resetDragState()
    return
  }

  if (!dragState.value.hasMoved) {
    logDragEvent('Pointer drag ended without movement')
    resetDragState()
    return
  }

  event.preventDefault()
  suppressNextClick()

  const targetFolderPath = dragState.value.dropTargetPath
  if (targetFolderPath) {
    const targetEntry = workspaceStore.findEntry(targetFolderPath)
    if (targetEntry?.is_dir) {
      logDragEvent('Pointer drop commit to folder', {
        sourcePath: dragState.value.sourcePath,
        targetPath: targetFolderPath,
      })
      handleDropOnFolder(targetEntry)
      return
    }
  }

  if (dragState.value.isOverRoot && workspaceStore.rootPath) {
    logDragEvent('Pointer drop commit to root', {
      sourcePath: dragState.value.sourcePath,
      rootPath: workspaceStore.rootPath,
    })
    void moveDraggedItem(workspaceStore.rootPath)
    return
  }

  logDragEvent('Pointer drop ended without valid target', {
    sourcePath: dragState.value.sourcePath,
  })
  resetDragState()
}

function handlePointerDragStart(event: MouseEvent, entry: FileEntry) {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  handleDragStart(entry)
  dragState.value.startX = event.clientX
  dragState.value.startY = event.clientY
  dragState.value.hasMoved = false
  document.addEventListener('mousemove', handlePointerDragMove)
  document.addEventListener('mouseup', handlePointerDragEnd)
  logDragEvent('Pointer drag tracking started', {
    sourcePath: entry.path,
    startX: event.clientX,
    startY: event.clientY,
  })
}

function getAffectedOpenDocuments(entry: FileEntry): OpenDocument[] {
  return documentStore.openDocuments.filter(doc => pathMatches(doc.path, entry.path, entry.is_dir))
}

async function handleDelete(entry: FileEntry) {
  const affectedDocuments = getAffectedOpenDocuments(entry)
  const unsavedCount = affectedDocuments.filter(doc => doc.isDirty).length

  let confirmationMessage = entry.is_dir
    ? `Delete folder "${entry.name}" and all contents?`
    : `Delete file "${entry.name}"?`

  if (affectedDocuments.length > 0) {
    const openSuffix = affectedDocuments.length === 1 ? '' : 's'
    confirmationMessage += `\n\nThis will close ${affectedDocuments.length} open file${openSuffix}.`
  }

  if (unsavedCount > 0) {
    const unsavedSuffix = unsavedCount === 1 ? '' : 's'
    confirmationMessage += `\n${unsavedCount} open file${unsavedSuffix} ha${unsavedCount === 1 ? 's' : 've'} unsaved changes that will be lost.`
  }

  const confirmed = confirm(confirmationMessage)
  if (!confirmed) return

  try {
    for (const document of affectedDocuments) {
      await documentStore.closeDocument(document.id, true)
    }

    await workspaceStore.deleteItem(entry.path)
  } catch (error) {
    console.error('Failed to delete:', error)
  }
  
  closeContextMenu()
}

function handleRename(entry: FileEntry) {
  triggerRename(entry.path)
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

  if (settingsStore.restoreWorkspaceOnLaunch) {
    workspaceStore.restoreWorkspace()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  clearPointerDragListeners()
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
    <ul
      v-else
      ref="treeListRef"
      class="tree-list"
      :class="{ 'is-drop-root': dragState.isOverRoot, 'is-pointer-dragging': dragState.hasMoved }"
      role="tree"
    >
      <FileTreeItem
        v-for="entry in entries"
        :key="entry.path"
        :entry="entry"
        :level="0"
        :is-expanded="workspaceStore.isExpanded(entry.path)"
        :active-path="documentStore.currentFilePath"
        :rename-path="renamePath"
        :dragging-path="dragState.sourcePath"
        :drop-target-path="dragState.dropTargetPath"
        @click="handleFileClick"
        @context-menu="handleContextMenu"
        @toggle="workspaceStore.toggleFolder"
        @pointer-drag-start="handlePointerDragStart"
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
          <button @click="startCreateFile(contextMenu.entry!.path)" title="New File">
            <i class="pi pi-file"></i> New File
          </button>
          <button @click="startCreateFolder(contextMenu.entry!.path)" title="New Folder">
            <i class="pi pi-folder"></i> New Folder
          </button>
          <div class="separator"></div>
        </template>
        <button @click="handleRename(contextMenu.entry!)" title="Rename">
          <i class="pi pi-pencil"></i> Rename
        </button>
        <button class="danger" @click="handleDelete(contextMenu.entry!)" title="Delete">
          <i class="pi pi-trash"></i> Delete
        </button>
      </div>
    </Teleport>

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
  background: rgba(var(--tt-brand-color-rgb), 0.2);
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
  border-radius: 6px;
}

.tree-list.is-drop-root {
  background: rgba(var(--tt-brand-color-rgb), 0.12);
  box-shadow: inset 0 0 0 1px rgba(var(--tt-brand-color-rgb), 0.55);
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
  color: var(--tt-brand-color-500);
}

.context-menu button.danger:hover {
  background: rgba(var(--tt-brand-color-rgb), 0.2);
}

.context-menu .separator {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0.25rem 0;
}
</style>
