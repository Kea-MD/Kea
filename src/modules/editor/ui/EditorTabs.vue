<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentStore, type OpenDocument } from '../state/documentStore'

interface Props {
  sidebarOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  sidebarOpen: true
})

const documentStore = useDocumentStore()

const tabs = computed(() => documentStore.openTabs)
const activeId = computed(() => documentStore.activeDocumentId)

function selectTab(id: string) {
  documentStore.setActiveDocument(id)
}

function closeTab(event: MouseEvent, id: string) {
  event.stopPropagation()
  documentStore.closeDocument(id)
}

function handleMiddleClick(event: MouseEvent, id: string) {
  if (event.button === 1) {
    event.preventDefault()
    documentStore.closeDocument(id)
  }
}

function createNewDocument() {
  documentStore.newFile()
}

function getTabClass(tab: OpenDocument) {
  return {
    'tab': true,
    'is-active': tab.id === activeId.value,
    'is-dirty': tab.isDirty,
  }
}
</script>

<template>
  <div class="tab-bar" :class="{ 'sidebar-closed': !props.sidebarOpen }">
    <div class="tabs-container">
      <div v-for="tab in tabs" :key="tab.id" :class="getTabClass(tab)" @click="selectTab(tab.id)"
        @mousedown="handleMiddleClick($event, tab.id)">
        <span class="tab-name">{{ tab.name }}</span>
        <span v-if="tab.isDirty" class="dirty-indicator" title="Unsaved changes"></span>
        <button class="close-btn" @click="closeTab($event, tab.id)" title="Close">
          <i class="pi pi-times"></i>
        </button>
      </div>
      <button class="new-tab-btn" @click="createNewDocument" title="New document" aria-label="New document">
        <i class="pi pi-plus"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  align-items: flex-start;
  padding: 7px 15px 0 15px;
  overflow: hidden;
  height: 40px;
  z-index: 1;
}

.tab-bar.sidebar-closed {
  padding-left: 90px;
}


.tabs-container {
  display: flex;
  gap: 7px;
  overflow-x: visible;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0 16px;
  margin: 0 -16px;
}

.tabs-container::-webkit-scrollbar {
  display: none;
}

/* Light mode (default) */
.tab {
  display: flex;
  align-items: top;
  gap: 10px;
  padding: 5px 5px 5px 15px;
  background: var(--tt-gray-light-200);
  border-radius: 13px;
  cursor: pointer;
  color: var(--tt-gray-light-600);
  font-size: 0.8125rem;
  white-space: nowrap;
  max-width: 180px;
  position: relative;
  height: 26px;
}

.tab:hover {
  background: var(--tt-gray-light-300);
  color: var(--tt-gray-light-700);
}

.tab.is-active {
  background: var(--tt-gray-light-200);
  color: var(--tt-brand-color-500);
  font-weight: 600;
  height: 33px;
  border-radius: 13px 13px 0 0;

}

/* Inverse radius effect - left side */
.tab.is-active::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: -22px;
  width: 22px;
  height: 22px;
  background: var(--tt-gray-light-200);
  clip-path: path('M 0 22 L 22 22 L 22 0 Q 22 22 0 22 Z');

  pointer-events: none;
}

/* Inverse radius effect - right side */
.tab.is-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: -22px;
  width: 22px;
  height: 22px;
  background: var(--tt-gray-light-200);
  pointer-events: none;
    clip-path: path('M 22 22 L 0 22 L 0 0 Q 0 22 22 22 Z');

}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.dirty-indicator {
  width: 8px;
  height: 8px;
  background: var(--tt-brand-color-500);
  border-radius: 50%;
  flex-shrink: 0;
  margin: 4px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.1s, background 0.1s;
  flex-shrink: 0;
}

.tab:hover .close-btn,
.tab.is-active .close-btn {
  opacity: 0.78;
}

.close-btn:hover {
  opacity: 1 !important;
  background: var(--tt-gray-light-a-200);
}

.close-btn .pi {
  font-size: 0.625rem;
}

.new-tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 13px;
  background: var(--tt-gray-light-200);
  color: var(--tt-gray-light-600);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
  margin-left: 2px;
}

.new-tab-btn:hover {
  background: var(--tt-gray-light-300);
  color: var(--tt-gray-light-700);
}

.new-tab-btn .pi {
  font-size: 0.625rem;
}

/* When dirty, show indicator instead of close on hover */
.tab.is-dirty:not(:hover) .close-btn {
  display: none;
}

.tab.is-dirty:hover .dirty-indicator {
  display: none;
}

/* Dark mode styles (unscoped to access .dark on html) */

.dark .tab {
  background: var(--tt-gray-dark-50);
  color: var(--tt-gray-dark-600);
}

.dark .tab:hover {
  background: var(--tt-gray-dark-200);
  color: var(--tt-gray-dark-700);
}

.dark .tab.is-active {
  background: var(--tt-gray-dark-50);
  color: var(--tt-brand-color-500);
}

.dark .close-btn:hover {
  background: var(--tt-gray-dark-a-200);
}

.dark .new-tab-btn {
  background: var(--tt-gray-dark-50);
  color: var(--tt-gray-dark-600);
}

.dark .new-tab-btn:hover {
  background: var(--tt-gray-dark-200);
  color: var(--tt-gray-dark-700);
}

.dark .tab.is-active::after {
  background: var(--tt-gray-dark-50);
}

.dark .tab.is-active::before {
  background: var(--tt-gray-dark-50);
}
</style>
