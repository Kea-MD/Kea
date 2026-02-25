<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useWorkspaceStore, type FileEntry } from '../state/workspaceStore'
import { useDocumentStore } from '../../editor/state/documentStore'

const props = defineProps<{
  entry: FileEntry
  level: number
  isExpanded: boolean
  activePath: string | null
  renamePath?: string | null
  draggingPath?: string | null
  dropTargetPath?: string | null
}>()

const emit = defineEmits<{
  (e: 'click', entry: FileEntry): void
  (e: 'context-menu', event: MouseEvent, entry: FileEntry): void
  (e: 'toggle', path: string): void
  (e: 'pointer-drag-start', event: MouseEvent, entry: FileEntry): void
}>()

const workspaceStore = useWorkspaceStore()
const documentStore = useDocumentStore()

const isRenaming = ref(false)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

const isActive = computed(() => props.activePath === props.entry.path)

const indent = computed(() => `${props.level * 1}rem`)

const icon = computed(() => {
  if (props.entry.is_dir) {
    return props.isExpanded ? 'pi-folder-open' : 'pi-folder'
  }
  if (props.entry.is_markdown) {
    return 'pi-file'
  }
  return 'pi-file'
})

const itemClass = computed(() => ({
  'tree-item': true,
  'is-dir': props.entry.is_dir,
  'is-markdown': props.entry.is_markdown,
  'is-other': !props.entry.is_dir && !props.entry.is_markdown,
  'is-active': isActive.value,
  'is-expanded': props.isExpanded,
  'is-dragging': props.draggingPath === props.entry.path,
  'is-drop-target': props.dropTargetPath === props.entry.path,
}))

function handleClick(_event: MouseEvent) {
  if (isRenaming.value) return
  emit('click', props.entry)
}

function handleContextMenu(event: MouseEvent) {
  emit('context-menu', event, props.entry)
}

function handleToggle(event: MouseEvent) {
  event.stopPropagation()
  emit('toggle', props.entry.path)
}

function handlePointerDragStart(event: MouseEvent) {
  if (isRenaming.value) {
    return
  }

  const target = event.target as HTMLElement | null
  if (target?.closest('button, input, textarea, [contenteditable="true"]')) {
    return
  }

  emit('pointer-drag-start', event, props.entry)
}

function handleTreeItemKeydown(event: KeyboardEvent) {
  if (isRenaming.value) return

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('click', props.entry)
    return
  }

  if (props.entry.is_dir && event.key === 'ArrowRight' && !props.isExpanded) {
    event.preventDefault()
    emit('toggle', props.entry.path)
    return
  }

  if (props.entry.is_dir && event.key === 'ArrowLeft' && props.isExpanded) {
    event.preventDefault()
    emit('toggle', props.entry.path)
    return
  }

  if (event.key === 'F2') {
    event.preventDefault()
    void startRename()
  }
}

async function startRename() {
  isRenaming.value = true
  renameValue.value = props.entry.name
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

async function confirmRename() {
  const trimmedName = renameValue.value.trim()
  const oldPath = props.entry.path

  if (!trimmedName || trimmedName === props.entry.name) {
    cancelRename()
    return
  }

  if (/[\\/]/.test(trimmedName) || trimmedName === '.' || trimmedName === '..') {
    console.error('Invalid name: names cannot include path separators or reserved names')
    return
  }

  try {
    const newPath = await workspaceStore.renameItem(oldPath, trimmedName)
    if (newPath) {
      documentStore.updatePathsAfterRename(oldPath, newPath, props.entry.is_dir)
    }
  } catch (error) {
    console.error('Failed to rename:', error)
  }

  cancelRename()
}

function cancelRename() {
  isRenaming.value = false
  renameValue.value = ''
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    confirmRename()
  } else if (event.key === 'Escape') {
    cancelRename()
  }
}

watch(
  () => props.renamePath,
  renamePath => {
    if (renamePath === props.entry.path && !isRenaming.value) {
      void startRename()
    }
  },
  { immediate: true }
)

defineExpose({ startRename })
</script>

<template>
  <li role="none">
    <div
      :class="itemClass"
      :style="{ paddingLeft: indent }"
      role="treeitem"
      :tabindex="0"
      :aria-level="level + 1"
      :aria-expanded="entry.is_dir ? isExpanded : undefined"
      :aria-selected="isActive"
      :data-entry-path="entry.path"
      :data-entry-dir="entry.is_dir ? 'true' : 'false'"
      @click="handleClick"
      @contextmenu="handleContextMenu"
      @dblclick="entry.is_dir ? null : startRename()"
      @mousedown.left="handlePointerDragStart"
      @keydown="handleTreeItemKeydown"
    >
      <!-- Expand/collapse toggle for directories -->
      <button
        v-if="entry.is_dir"
        type="button"
        class="toggle-btn"
        @click="handleToggle"
        :aria-expanded="isExpanded"
        :aria-label="isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`"
        :title="isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`"
      >
        <i class="pi" :class="isExpanded ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
      </button>
      <span v-else class="toggle-spacer"></span>

      <!-- Icon -->
      <i class="pi item-icon" :class="icon"></i>

      <!-- Name or rename input -->
      <input
        v-if="isRenaming"
        ref="renameInput"
        v-model="renameValue"
        type="text"
        class="rename-input"
        @blur="confirmRename"
        @keydown="handleKeydown"
        @click.stop
      />
      <span v-else class="item-name">{{ entry.name }}</span>
    </div>

    <!-- Children (for directories) -->
    <ul
      v-if="entry.is_dir && entry.children && isExpanded"
      class="tree-children"
      role="group"
    >
      <FileTreeItem
        v-for="child in entry.children"
        :key="child.path"
        :entry="child"
        :level="level + 1"
        :is-expanded="workspaceStore.isExpanded(child.path)"
        :active-path="activePath"
        :rename-path="renamePath"
        :dragging-path="draggingPath"
        :drop-target-path="dropTargetPath"
        @click="emit('click', $event)"
        @context-menu="(event, entry) => emit('context-menu', event, entry)"
        @toggle="emit('toggle', $event)"
        @pointer-drag-start="(event, entry) => emit('pointer-drag-start', event, entry)"
      />
    </ul>
  </li>
</template>

<style scoped>
.tree-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  width: 100%;
  min-width: 0;
  cursor: pointer;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.8);
  transition: background 0.1s;
}

.tree-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.tree-item.is-active {
  background: rgba(var(--tt-brand-color-rgb), 0.3);
  color: white;
}

.tree-item.is-active.is-other {
  opacity: 1;
}

.tree-item.is-active .item-icon,
.tree-item.is-active .item-name {
  color: white;
}

.tree-item.is-other {
  opacity: 0.5;
}

.tree-item.is-dragging {
  opacity: 0.45;
}

.tree-item.is-drop-target {
  background: rgba(var(--tt-brand-color-rgb), 0.22);
  box-shadow: inset 0 0 0 1px rgba(var(--tt-brand-color-rgb), 0.7);
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  border-radius: 3px;
  flex-shrink: 0;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.toggle-btn .pi {
  font-size: 0.625rem;
}

.toggle-spacer {
  width: 18px;
  flex-shrink: 0;
}

.item-icon {
  font-size: 0.875rem;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.6);
}

.is-dir .item-icon {
  color: var(--tt-brand-color-500);
}

.is-markdown .item-icon {
  color: var(--tt-brand-color-500);
}

.item-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rename-input {
  flex: 1;
  padding: 0.125rem 0.25rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--tt-brand-color-500);
  border-radius: 3px;
  color: white;
  font-size: inherit;
  min-width: 0;
}

.rename-input:focus {
  outline: none;
}

.tree-children {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
