<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useWorkspaceStore, type FileEntry } from '../state/workspaceStore'
import { useDocumentStore } from '../../editor/state/documentStore'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const workspaceStore = useWorkspaceStore()
const documentStore = useDocumentStore()

const searchQuery = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

// Collect all markdown files from workspace
const allFiles = computed(() => {
  const files: FileEntry[] = []
  
  function collectFiles(entries: FileEntry[]) {
    for (const entry of entries) {
      if (entry.is_markdown) {
        files.push(entry)
      }
      if (entry.children) {
        collectFiles(entry.children)
      }
    }
  }
  
  collectFiles(workspaceStore.entries)
  return files
})

// Simple fuzzy search
function fuzzyMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase()
  const queryLower = query.toLowerCase()
  
  let queryIndex = 0
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++
    }
  }
  
  return queryIndex === queryLower.length
}

// Score for sorting (higher = better match)
function matchScore(text: string, query: string): number {
  const textLower = text.toLowerCase()
  const queryLower = query.toLowerCase()
  
  // Exact match at start
  if (textLower.startsWith(queryLower)) return 100
  
  // Contains query
  if (textLower.includes(queryLower)) return 50
  
  // Fuzzy match - score based on consecutive matches
  let score = 0
  let consecutive = 0
  let queryIndex = 0
  
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      consecutive++
      score += consecutive
      queryIndex++
    } else {
      consecutive = 0
    }
  }
  
  return score
}

const filteredFiles = computed(() => {
  if (!searchQuery.value.trim()) {
    // Show recent files first, then all files
    const recentPaths = new Set(documentStore.recentFiles.map(f => f.path))
    const recent = allFiles.value.filter(f => recentPaths.has(f.path))
    const others = allFiles.value.filter(f => !recentPaths.has(f.path))
    return [...recent, ...others].slice(0, 20)
  }
  
  const query = searchQuery.value.trim()
  return allFiles.value
    .filter(file => fuzzyMatch(file.name, query))
    .sort((a, b) => matchScore(b.name, query) - matchScore(a.name, query))
    .slice(0, 20)
})

// Reset selection when results change
watch(filteredFiles, () => {
  selectedIndex.value = 0
})

function getRelativePath(path: string): string {
  if (!workspaceStore.rootPath) return path
  return path.replace(workspaceStore.rootPath + '/', '')
}

async function selectFile(file: FileEntry) {
  await documentStore.openFileFromPath(file.path)
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, filteredFiles.value.length - 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      break
    case 'Enter':
      event.preventDefault()
      if (filteredFiles.value[selectedIndex.value]) {
        selectFile(filteredFiles.value[selectedIndex.value])
      }
      break
    case 'Escape':
      event.preventDefault()
      emit('close')
      break
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}

onMounted(async () => {
  await nextTick()
  inputRef.value?.focus()
})
</script>

<template>
  <div class="quick-switcher-overlay" @click="handleBackdropClick">
    <div class="quick-switcher">
      <div class="search-container">
        <i class="pi pi-search search-icon"></i>
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="Search files..."
          @keydown="handleKeydown"
        />
      </div>
      
      <div class="results-container">
        <div v-if="filteredFiles.length === 0" class="no-results">
          <p v-if="!workspaceStore.hasWorkspace">Open a folder to search files</p>
          <p v-else-if="searchQuery">No matching files found</p>
          <p v-else>No files in workspace</p>
        </div>
        
        <div
          v-for="(file, index) in filteredFiles"
          :key="file.path"
          class="result-item"
          :class="{ 'is-selected': index === selectedIndex }"
          @click="selectFile(file)"
          @mouseenter="selectedIndex = index"
        >
          <i class="pi pi-file result-icon"></i>
          <div class="result-content">
            <span class="result-name">{{ file.name }}</span>
            <span class="result-path">{{ getRelativePath(file.path) }}</span>
          </div>
        </div>
      </div>
      
      <div class="shortcuts-hint">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>↵</kbd> Open</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quick-switcher-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  z-index: 1000;
}

.quick-switcher {
  width: 100%;
  max-width: 560px;
  background: rgba(30, 30, 32, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.search-container {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.search-icon {
  color: rgba(255, 255, 255, 0.4);
  margin-right: 0.75rem;
  font-size: 1rem;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  color: white;
  font-size: 1rem;
  outline: none;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.results-container {
  max-height: 400px;
  overflow-y: auto;
}

.no-results {
  padding: 2rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

.no-results p {
  margin: 0;
}

.result-item {
  display: flex;
  align-items: center;
  padding: 0.625rem 1rem;
  cursor: pointer;
  transition: background 0.1s;
}

.result-item:hover,
.result-item.is-selected {
  background: rgba(255, 255, 255, 0.08);
}

.result-item.is-selected {
  background: rgba(var(--tt-brand-color-rgb), 0.3);
}

.result-icon {
  color: var(--tt-brand-color-500);
  margin-right: 0.75rem;
  font-size: 0.875rem;
}

.result-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.result-name {
  color: rgba(255, 255, 255, 0.95);
  font-size: 0.875rem;
}

.result-path {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shortcuts-hint {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.shortcuts-hint kbd {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-family: inherit;
  margin-right: 0.25rem;
}
</style>
