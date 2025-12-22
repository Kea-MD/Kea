<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import Editor from '../components/editor/Editor.vue'
import Sidebar from '../components/sidebar/Sidebar.vue'
import TabBar from '../components/editor/TabBar.vue'
import EditorToolbar from '../components/editor/EditorToolbar.vue'
import QuickSwitcher from '../components/QuickSwitcher.vue'
import { useTheme } from '../composables/useTheme'
import { useSidebarResize } from '../composables/useSidebarResize'
import { useDocumentStore } from '../stores/documentStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

// Initialize stores
const documentStore = useDocumentStore()
const workspaceStore = useWorkspaceStore()

// Editor ref to access the TipTap editor instance
const editorRef = ref<InstanceType<typeof Editor> | null>(null)
const editorInstance = computed(() => editorRef.value?.editor)

// Initialize theme
useTheme()

// Sidebar resize
const { sidebarWidth, isResizing, startResize } = useSidebarResize()

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

// Handle menu events from Tauri
let unlistenMenu: (() => void) | null = null

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
    case 'redo':
    case 'find':
      // These are handled by the editor
      break
  }
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  const isMod = event.metaKey || event.ctrlKey

  if (isMod && event.key === 'p') {
    event.preventDefault()
    showQuickSwitcher.value = true
  }
}

onMounted(() => {
  setupMenuListener()
  documentStore.loadRecentFiles()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  unlistenMenu?.()
  window.removeEventListener('keydown', handleKeydown)
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
            <TabBar :sidebar-open="sidebarOpen" />
            <EditorToolbar
              :editor="editorInstance"
              :sidebar-open="sidebarOpen"
              @toggle-sidebar="toggleSidebar"
              @hover-sidebar="handleSidebarHover"
            />
          </div>
          <div class="editorContent">
            <Editor ref="editorRef" />
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Switcher Modal -->
    <QuickSwitcher
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
  background: var(--tt-bg-color);
  overflow: hidden;
  position: relative;
}

.editorHeader {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  z-index: 10;
  filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.4));
}

.editorContent {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding-top: 79px; /* toolbar (42px) + tabbar (37px) */
}
</style>
