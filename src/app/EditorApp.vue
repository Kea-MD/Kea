<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import EditorSurface from '../modules/editor/ui/EditorSurface.vue'
import Sidebar from '../modules/workspace/ui/Sidebar.vue'
import EditorTabs from '../modules/editor/ui/EditorTabs.vue'
import EditorToolbar from '../modules/editor/ui/EditorToolbar.vue'
import QuickOpenDialog from '../modules/workspace/ui/QuickOpenDialog.vue'
import { useTheme } from '../shared/composables/useTheme'
import { useSidebarResize } from '../modules/workspace/runtime/useSidebarResize'
import { useExternalFileSync } from '../modules/workspace/runtime/useExternalFileSync'
import { useDocumentStore } from '../modules/editor/state/documentStore'
import { useWorkspaceStore } from '../modules/workspace/state/workspaceStore'
import {
  addEditorUiStateListener,
  dispatchEditorCommand,
  type EditorCommand,
  type EditorMode,
} from '../modules/editor/editorCommands'

// Initialize stores
const documentStore = useDocumentStore()
const workspaceStore = useWorkspaceStore()

const hasOpenFile = computed(() => documentStore.activeDocument !== null)
const editorMode = computed(() => documentStore.editorMode)
const isFindOpen = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)

// Initialize theme
useTheme()

// Sidebar resize
const { sidebarWidth, isResizing, startResize } = useSidebarResize()
useExternalFileSync()

// Sidebar state
const sidebarOpen = ref(true)
const sidebarHovering = ref(false)
const hoverDisabled = ref(false)
let hoverTimeout: ReturnType<typeof setTimeout> | null = null

// Quick switcher state
const showQuickSwitcher = ref(false)

const toggleSidebar = () => {
  const wasOpen = sidebarOpen.value
  sidebarOpen.value = !sidebarOpen.value

  // If closing the sidebar, temporarily disable hover
  if (wasOpen) {
    hoverDisabled.value = true
    sidebarHovering.value = false
    setTimeout(() => {
      hoverDisabled.value = false
    }, 300)
  }
}

const handleSidebarHover = (hovering: boolean) => {
  if (hoverDisabled.value) return

  // Clear any pending unhover timeout
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }

  if (hovering) {
    sidebarHovering.value = true
  } else {
    // Delay unhover to prevent flickering
    hoverTimeout = setTimeout(() => {
      sidebarHovering.value = false
    }, 200)
  }
}

const handleNewRequest = () => {
  documentStore.newFile()
}

const handleFeedback = () => {
  console.log('Feedback')
}

const handleSettings = () => {
  console.log('Settings')
}

const handleEditorCommand = (command: EditorCommand) => {
  dispatchEditorCommand(command)
}

const handleEditorMode = (mode: EditorMode) => {
  documentStore.setEditorMode(mode)
}

const hasExternalChange = computed(() => documentStore.hasExternalChange)

const externalChangePath = computed(() => {
  const path = documentStore.externalChange?.path
  if (!path) return ''

  return path.split('/').pop() || path
})

const acceptExternalChange = () => {
  documentStore.acceptExternalChange()
}

const keepLocalVersion = () => {
  documentStore.keepLocalVersion()
}

// Handle menu events from Tauri
let unlistenMenu: (() => void) | null = null
let removeEditorUiStateListener: (() => void) | null = null

async function setupMenuListener() {
  unlistenMenu = await listen<string>('menu-event', (event) => {
    handleMenuAction(event.payload)
  })
}

function handleMenuAction(action: string) {
  switch (action) {
    case 'new_file':
      documentStore.newFile()
      break
    case 'open_file':
      documentStore.openFileDialog()
      break
    case 'open_folder':
      workspaceStore.openFolder()
      break
    case 'save':
      documentStore.saveFile()
      break
    case 'save_as':
      documentStore.saveFileAs()
      break
    case 'close_tab':
      if (documentStore.activeDocumentId) {
        documentStore.closeDocument(documentStore.activeDocumentId)
      }
      break
    case 'toggle_sidebar':
      toggleSidebar()
      break
    case 'quick_open':
      showQuickSwitcher.value = true
      break
    case 'undo':
      dispatchEditorCommand('undo')
      break
    case 'redo':
      dispatchEditorCommand('redo')
      break
    case 'find':
      dispatchEditorCommand('find')
      break
    case 'toggle_editor_mode':
      documentStore.toggleEditorMode()
      break
  }
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  const isMod = event.metaKey || event.ctrlKey

  if (isMod && event.key === 'p') {
    event.preventDefault()
    showQuickSwitcher.value = true
    return
  }

  if (isMod && event.key.toLowerCase() === 'e') {
    event.preventDefault()
    documentStore.toggleEditorMode()
  }
}

onMounted(() => {
  setupMenuListener()
  documentStore.loadRecentFiles()
  window.addEventListener('keydown', handleKeydown)

  removeEditorUiStateListener = addEditorUiStateListener(({ findOpen, canUndo: nextCanUndo, canRedo: nextCanRedo }) => {
    if (typeof findOpen === 'boolean') {
      isFindOpen.value = findOpen
    }

    if (typeof nextCanUndo === 'boolean') {
      canUndo.value = nextCanUndo
    }

    if (typeof nextCanRedo === 'boolean') {
      canRedo.value = nextCanRedo
    }
  })
})

onUnmounted(() => {
  unlistenMenu?.()
  window.removeEventListener('keydown', handleKeydown)
  removeEditorUiStateListener?.()
  removeEditorUiStateListener = null
})
</script>

<template>
  <div class="page">
    <div class="topDragRegion" data-tauri-drag-region></div>
    <div class="pageContainer">
      <div
        class="layout"
        :class="{ 'sidebar-open': sidebarOpen, 'is-resizing': isResizing }"
        :style="sidebarOpen ? { gridTemplateColumns: `${sidebarWidth}px 1fr` } : undefined"
      >
        <Sidebar
          :is-open="sidebarOpen"
          :is-hovering="sidebarHovering"
          :width="sidebarWidth"
          @new-request="handleNewRequest"
          @feedback="handleFeedback"
          @settings="handleSettings"
        />

        <!-- Resize handle -->
        <div
          v-if="sidebarOpen"
          class="resize-handle"
          :class="{ 'is-resizing': isResizing }"
          @mousedown="startResize"
        />

        <div class="mainEditor">
          <div class="editorHeader">
            <EditorTabs :sidebar-open="sidebarOpen" />
            <EditorToolbar
              :sidebar-open="sidebarOpen"
              :has-open-file="hasOpenFile"
              :find-open="isFindOpen"
              :can-undo="canUndo"
              :can-redo="canRedo"
              :editor-mode="editorMode"
              @toggle-sidebar="toggleSidebar"
              @hover-sidebar="handleSidebarHover"
              @command="handleEditorCommand"
              @set-editor-mode="handleEditorMode"
            />
            <div v-if="hasExternalChange" class="external-change-banner" role="status">
              <span class="banner-text">
                <strong>{{ externalChangePath }}</strong> changed on disk.
              </span>
              <div class="banner-actions">
                <button class="banner-btn secondary" @click="keepLocalVersion">Keep local</button>
                <button class="banner-btn" @click="acceptExternalChange">Reload disk</button>
              </div>
            </div>
          </div>
          <div class="editorContent" :class="{ 'has-external-banner': hasExternalChange }">
            <EditorSurface />
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Switcher Modal -->
    <QuickOpenDialog
      v-if="showQuickSwitcher"
      @close="showQuickSwitcher = false"
    />
  </div>
</template>

<style scoped>
/* Page Layout */
.page {
  position: relative;
  display: flex;
  width: 100vw;
  height: 100vh;
  padding: 7.5px;
  overflow: hidden;
  border-radius: 37.5px;
  overscroll-behavior: none;
}

.topDragRegion {
  position: absolute;
  inset: 0 0 auto 0;
  height: 20px;
  z-index: 9999;
  -webkit-app-region: drag;
}

.pageContainer {
  width: 100%;
  display: flex;
  padding: 7.5px;
  flex: 1;
  background: rgba(10, 10, 10, 0.8);
  border-radius: 37.5px;
  overscroll-behavior: none;
}

/* Layout Grid */
.layout {
  width: 100%;
  display: grid;
  grid-template-columns: 0 1fr;
  transition: grid-template-columns 0.16s cubic-bezier(0.0, 0.0, 0.58, 1.0);
}

.layout.sidebar-open {
  grid-template-columns: 260px 1fr;
}

.layout.is-resizing {
  transition: none;
}

/* Resize Handle */
.resize-handle {
  position: absolute;
  top: 40px;
  bottom: 5px;
  width: 8px;
  left: calc(v-bind(sidebarWidth) * 1px + 5px);
  cursor: col-resize;
  z-index: 10;
  border-radius: 4px;
  transition: background 0.15s ease;
}

.resize-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 3px;
  height: 40px;
  border-radius: 2px;
  background: transparent;
  transition: background 0.15s ease;
}

.resize-handle:hover::after,
.resize-handle.is-resizing::after {
  background: var(--tt-gray-light-a-300);
}

.dark .resize-handle:hover::after,
.dark .resize-handle.is-resizing::after {
  background: var(--tt-gray-dark-a-300);
}

/* Main Editor */
.mainEditor {
  display: flex;
  flex-direction: column;
  flex: 1;
  border-radius: 30px;
  background: var(--white);
  overflow: hidden;
  position: relative;
}

.dark .mainEditor {
  background: var(--tt-gray-dark-a-50);
}

.editorHeader {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.external-change-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(253, 244, 179, 0.8);
  border-bottom: 1px solid rgba(117, 95, 0, 0.25);
}

.dark .external-change-banner {
  background: rgba(85, 69, 0, 0.7);
  border-bottom-color: rgba(250, 222, 110, 0.3);
}

.banner-text {
  font-size: 12px;
  color: rgba(63, 49, 0, 0.95);
}

.dark .banner-text {
  color: rgba(255, 243, 191, 0.95);
}

.banner-actions {
  display: flex;
  gap: 8px;
}

.banner-btn {
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  background: rgba(117, 95, 0, 0.9);
  color: white;
}

.banner-btn.secondary {
  background: rgba(0, 0, 0, 0.15);
  color: rgba(63, 49, 0, 0.95);
}

.dark .banner-btn.secondary {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 243, 191, 0.95);
}

.banner-btn:hover {
  filter: brightness(1.05);
}

.editorContent {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding-top: 79px; /* toolbar (42px) + tabbar (37px) */
}

.editorContent.has-external-banner {
  padding-top: 117px;
}
</style>
