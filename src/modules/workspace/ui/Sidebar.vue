<script setup lang="ts">
import SidebarHeader from './SidebarHeader.vue'
import FileTree from './FileTree.vue'
import SidebarFooter from './SidebarFooter.vue'

interface Props {
  isOpen: boolean
  isHovering?: boolean
  width?: number
}

const props = withDefaults(defineProps<Props>(), {
  isHovering: false,
  width: 260
})

const emit = defineEmits<{
  (e: 'new-request'): void
  (e: 'feedback'): void
  (e: 'settings'): void
}>()
</script>

<template>
  <div
    class="aside"
    :class="{ 'sidebar-open': isOpen, 'sidebar-hovering': isHovering }"
    :style="isOpen ? { width: `${props.width}px` } : undefined"
  >
    <!-- Safety triangle to prevent accidental close when moving from button to sidebar -->
    <div class="safety-triangle" :class="{ 'is-active': isHovering && !isOpen }"></div>
    <aside
      class="sidebar"
      :class="{ 'is-open': isOpen }"
      :style="{ width: `${props.width - 10}px` }"
    >
      <SidebarHeader />

      <nav class="sidebar-nav" aria-label="Navigation">
        <FileTree />
      </nav>

      <SidebarFooter
        @feedback="emit('feedback')"
        @settings="emit('settings')"
      />
    </aside>
  </div>
</template>

<style scoped>
/* Aside container */
.aside {
  position: relative;
  z-index: 4;
  overflow: visible;
  width: 0;
  transition: width 0.16s cubic-bezier(0, 0, 0.58, 1);
  pointer-events: none;
}

.aside:not(.sidebar-open).sidebar-hovering,
.aside:not(.sidebar-open):has(.sidebar:hover),
.aside:not(.sidebar-open):has(.safety-triangle:hover) {
  z-index: 400;
}

.aside.sidebar-open,
.aside.sidebar-hovering,
.aside:has(.sidebar:hover),
.aside:has(.safety-triangle:hover) {
  pointer-events: auto;
}

.aside.sidebar-open {
  width: 260px; /* Default, overridden by inline style */
}

/* Safety triangle - connects button to sidebar */
.safety-triangle {
  position: absolute;
  top: 40px;
  left: 0;
  width: 250px;
  height: 50px;
  clip-path: polygon(20px 30px, 40px 30px, 250px 50px, 10px 50px);
  pointer-events: none;
  z-index: 10;
}

.safety-triangle.is-active,
.aside:not(.sidebar-open):has(.sidebar:hover) .safety-triangle,
.aside:not(.sidebar-open) .safety-triangle:hover {
  pointer-events: auto;
}

/* Hover state - reveal sidebar */
.aside:not(.sidebar-open).sidebar-hovering .sidebar,
.aside:not(.sidebar-open):has(.safety-triangle:hover) .sidebar,
.aside:not(.sidebar-open) .sidebar:hover {
  transform: translateX(0);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(15px) saturate(180%);
  opacity: 1;
  border: 1px solid rgba(255, 255, 255, 0.05);
  /* Opening animation - quick and snappy */
  transition:
    transform 0.16s cubic-bezier(0, 0, 0.58, 1),
    backdrop-filter 0.16s cubic-bezier(0, 0, 0.58, 1),
    opacity 0.16s cubic-bezier(0, 0, 0.58, 1),
    background 0.16s cubic-bezier(0, 0, 0.58, 1),
    top 0.16s cubic-bezier(0, 0, 0.58, 1),
    height 0.16s cubic-bezier(0, 0, 0.58, 1);
}

/* Sidebar */
.sidebar {
  position: absolute;
  left: 5px;
  top: 90px;
  width: 250px; /* Default, overridden by inline style */
  height: calc(100% - 95px);
  display: grid;
  grid-template-rows: auto 1fr auto;
  font-size: 0.875rem;
  color: rgba(163, 163, 168, 1);
  padding: 10px;
  border-radius: 25px;
  background: transparent;
  opacity: 0;
  transform: translateX(-100%);
  /* Closing animation - reverse of opening (same duration, ease-in) */
  transition:
    transform 0.16s cubic-bezier(0.42, 0, 1, 1),
    backdrop-filter 0.16s cubic-bezier(0.42, 0, 1, 1),
    opacity 0.16s cubic-bezier(0.42, 0, 1, 1),
    background 0.16s cubic-bezier(0.42, 0, 1, 1),
    top 0.16s cubic-bezier(0.42, 0, 1, 1),
    height 0.16s cubic-bezier(0.42, 0, 1, 1);
}

.sidebar.is-open {
  transform: translateX(0);
  top: 25px;
  height: calc(100% - 25px);
  opacity: 1;
}

.sidebar-nav {
  overflow: hidden;
  padding: 0 0.5rem;
}

/* Mobile */
@media (max-width: 768px) {
  .aside.sidebar-open {
    width: 0;
  }

  .sidebar {
    position: fixed;
    height: 100vh;
    top: 0;
    border-radius: 0;
    z-index: 100;
  }
}
</style>
