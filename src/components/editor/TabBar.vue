<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentStore, type OpenDocument } from '../../stores/documentStore'

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

function getTabClass(tab: OpenDocument) {
  return {
    'tab': true,
    'is-active': tab.id === activeId.value,
    'is-dirty': tab.isDirty,
  }
}
</script>

<template>
  <div class="tab-bar" v-if="tabs.length > 0">
    <div class="tabs-container">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        :class="getTabClass(tab)"
        @click="selectTab(tab.id)"
        @mousedown="handleMiddleClick($event, tab.id)"
      >
        <span class="tab-icon">
          <i class="pi pi-file"></i>
        </span>
        <span class="tab-name">{{ tab.name }}</span>
        <span v-if="tab.isDirty" class="dirty-indicator" title="Unsaved changes"></span>
        <button
          class="close-btn"
          @click="closeTab($event, tab.id)"
          title="Close"
        >
          <i class="pi pi-times"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 10px 25px;
  background: transparent;
  border-bottom: 1px solid var(--tt-border-color-tint);
  overflow: hidden;
}

.tabs-container {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tabs-container::-webkit-scrollbar {
  display: none;
}

/* Light mode (default) */
.tab {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.37rem 1rem;
  background: var(--tt-gray-light-a-50);
  border-radius: 20px;
  cursor: pointer;
  color: var(--tt-gray-light-500);
  font-size: 0.8125rem;
  white-space: nowrap;
  max-width: 180px;
  transition: background 0.1s, color 0.1s;
  position: relative;
}

.tab:hover {
  background: var(--tt-gray-light-a-100);
  color: var(--tt-gray-light-700);
}

.tab.is-active {
  background: var(--tt-gray-light-a-200);
  color: var(--tt-gray-light-800);
  border-radius: 15px 15px 0 0;
}

/* Dark mode */
:global(.dark) .tab {
  background: var(--tt-gray-dark-a-50);
  color: var(--tt-gray-dark-500);
}

:global(.dark) .tab:hover {
  background: var(--tt-gray-dark-a-100);
  color: var(--tt-gray-dark-700);
}

:global(.dark) .tab.is-active {
  background: var(--tt-gray-dark-a-200);
  color: var(--tt-gray-dark-900);
}

.tab.is-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--tt-brand-color-500);
}

.tab-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.tab-icon .pi {
  font-size: 0.75rem;
  color: var(--tt-brand-color-500);
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.dirty-indicator {
  width: 6px;
  height: 6px;
  background: var(--tt-brand-color-500);
  border-radius: 50%;
  flex-shrink: 0;
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
  opacity: 0.6;
}

.close-btn:hover {
  opacity: 1 !important;
  background: var(--tt-gray-light-a-200);
}

:global(.dark) .close-btn:hover {
  background: var(--tt-gray-dark-a-200);
}

.close-btn .pi {
  font-size: 0.625rem;
}

/* When dirty, show indicator instead of close on hover */
.tab.is-dirty:not(:hover) .close-btn {
  display: none;
}

.tab.is-dirty:hover .dirty-indicator {
  display: none;
}
</style>
