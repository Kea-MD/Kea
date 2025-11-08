<script setup lang="ts">
import SidePanel from '../components/side-panel.vue'
import Button from '../components/button.vue'
import SimpleEditor from '../components/simple-editor.vue'
import AIToolbar from '../components/ai-toolbar.vue'
import Logo from '../components/logo.vue'

</script>

<template>
  <div class="page">
    <div class="pageContainer">
      <!-- Left Sidebar -->
      <SidePanel
        class="sidebar"
        resize-from="right"
      >
        <!-- Sidebar Header -->
        <div class="sidebarHeader">
          <Logo />
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
          <div class="editorTabBar">
          </div>
        </div>

        <!-- Editor Content -->
        <div class="editorContent">
          <SimpleEditor />
          <!-- <Tiptap/> -->
        </div>

        <!-- Editor Footer -->
        <AIToolbar />
      </div>

      
    </div>
  </div>
</template>

<style scoped>

/* Page */
.page {
  background: var(--background);
  display: flex;
  width: 100vw;
  height: 100vh;
  padding: var(--space-3);
}

.pageContainer {
  width: 100%;
  display: flex;
  padding: var(--space-3);
  align-items: flex-start;
  flex: 1 0 0;
  align-self: stretch;
  background: var(--surface);
  border-radius: var(--radius-lg);
}

/* Sidebar */
.sidebar {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  padding: var(--space);
  height: 100%;
}

.sidebarHeader {
  display: flex;
  height: 50px;
  padding: 0 var(--space-4);
  align-items: center;
  gap: var(--space-4);
  align-self: stretch;
  border-bottom: 1px solid var(--surface);
}

.menuItems {
  display: flex;
  height: 50px;
  padding: var(--space-4) 0;
  justify-content: center;
  align-items: center;
  gap: var(--space-4);
  align-self: stretch;
}

.sidebarContent {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1 0 0;
  align-self: stretch;
}

.sidebarFooter {
  display: flex;
  height: 50px;
  padding: 0 var(--space-4);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  align-self: stretch;
  border-top: 1px solid var(--surface);
}

/* Main Editor */
.mainEditor {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1 0 0;
  align-self: stretch;
  border-radius: var(--radius);
  background: var(--tt-bg-color);
  padding: var(--space);
  overflow: hidden;
  position: relative;
}

.editorHeader {
  display: flex;
  flex-direction: column;
  align-items: center;
  align-self: stretch;
  box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.2);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.editorTabBar {
  height: 30px;
  width: 100%;
  padding: 0 0 0 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  align-self: stretch;
  background: #00000010;
}

/* set the button to the right of the toolbar */
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
  overflow: none;
  padding-top: 30px; /* Account for the absolute positioned header */
}

/* Icons */
.icon {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
}

</style>

