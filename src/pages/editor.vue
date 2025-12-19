<script setup lang="ts">
import { ref } from 'vue'
import Editor from '../components/editor/Editor.vue'
import Sidebar from '../components/sidebar/Sidebar.vue'
import { useTheme } from '../composables/useTheme'

// Initialize theme
useTheme()

// Sidebar state
const sidebarOpen = ref(true)
const sidebarHovering = ref(false)
const hoverDisabled = ref(false)
let hoverTimeout: ReturnType<typeof setTimeout> | null = null

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
  // TODO: Implement new request logic
  console.log('New request')
}

const handleFeedback = () => {
  // TODO: Implement feedback logic
  console.log('Feedback')
}

const handleSettings = () => {
  // TODO: Implement settings logic
  console.log('Settings')
}
</script>

<template>
  <div class="page">
    <div class="topDragRegion" data-tauri-drag-region></div>
    <div class="pageContainer">
      <div class="layout" :class="{ 'sidebar-open': sidebarOpen }">
        <Sidebar
          :is-open="sidebarOpen"
          :is-hovering="sidebarHovering"
          @new-request="handleNewRequest"
          @feedback="handleFeedback"
          @settings="handleSettings"
        />

        <div class="mainEditor">
          <div class="editorHeader">
            <div class="editorTabBar"></div>
          </div>
          <div class="editorContent">
            <Editor
              :sidebar-open="sidebarOpen"
              @toggle-sidebar="toggleSidebar"
              @hover-sidebar="handleSidebarHover"
            />
          </div>
        </div>
      </div>
    </div>
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

/* Main Editor */
.mainEditor {
  display: flex;
  flex-direction: column;
  flex: 1;
  border-radius: 30px;
  background: var(--tt-bg-color);
  padding: 10px;
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
}

.editorTabBar {
  height: 0px;
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.editorContent {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding-top: 30px;
}
</style>
