<script setup lang="ts">
import Button from '../components/button.vue'
import SidePanel from '../components/side-panel.vue'
import SimpleEditor from '../components/simple-editor.vue'
</script>

<template>
  <div class="page">
    <!-- Top drag region for window traffic lights (macOS) -->
    <div class="topDragRegion" data-tauri-drag-region></div>
    <div class="pageContainer">
      <!-- Left Sidebar -->
      <SidePanel
        class="sidebar"
        resize-from="right"
      >
        <!-- Sidebar Header -->
        <div class="sidebarHeader" data-tauri-drag-region>
          <Button variant="primary" size="medium" icon="dock_to_right" />
        </div>

        <!-- Sidebar Content -->
        <div class="sidebarContent">
        </div>

        <!-- Sidebar Footer -->
        <div class="sidebarFooter">
          <Button variant="primary" size="medium" icon="settings" />
          <Button variant="primary" size="medium" icon="person_add" />
        </div>
      </SidePanel>

      <!-- Main Editor -->
      <div class="mainEditor">
        <!-- Editor Header -->
        <div class="editorHeader">
          <!-- Editor Tab Bar -->
          <div class="editorTabBar" data-tauri-drag-region>
          </div>
        </div>

        <!-- Editor Content -->
        <div class="editorContent">
          <SimpleEditor />
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
  height: 30px;
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

/* Sidebar */
.sidebar {
  display: flex;
  flex-direction: column;
  padding: 10px;
  height: 100%;
}

.sidebarHeader {
  display: flex;
  height: 70px;
  padding: 0 10px;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  justify-content: flex-end;
}

.menuItems {
  display: flex;
  height: 50px;
  padding: 15px 0;
  justify-content: center;
  align-items: center;
  gap: 15px;
}

.sidebarContent {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.sidebarFooter {
  display: flex;
  height: 50px;
  padding: 0 15px;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
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
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
}

.editorTabBar {
  height: 30px;
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: rgba(0, 0, 0, 0.063);
}

.editorToolbarButton {
  position: absolute;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.editorContent {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding-top: 30px;
}

.icon {
  display: flex;
  flex-direction: column;
  gap: 7.5px;
  padding: 15px;
}
</style>

