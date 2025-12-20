<script setup lang="ts">

interface Props {
  searchTerm: string
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:searchTerm', value: string): void
}>()

const handleSearch = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:searchTerm', target.value)
}

const clearSearch = () => {
  emit('update:searchTerm', '')
}
</script>

<template>
  <header class="sidebar-header">
    <form @submit.prevent>
      <div class="tree-search-input-container">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          type="text"
          id="tree-search"
          placeholder="Find"
          aria-label="Filter navigation tree"
          class="tree-search-input"
          :value="searchTerm"
          @input="handleSearch"
          @keydown.escape="clearSearch"
        >
        <kbd>/</kbd>
      </div>
    </form>
  </header>
</template>

<style scoped>
.sidebar-header {
  padding: 0.75rem;
  display: grid;
  gap: 0.5rem;
}

/* Search input */
.tree-search-input-container {
  position: relative;
}

.tree-search-input-container .search-icon {
  position: absolute;
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
  font-size: 16px;
  opacity: 0.6;
}

.tree-search-input-container kbd {
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  font-size: 0.625rem;
  border-radius: 2px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
  display: grid;
  place-items: center;
  right: 8px;
  transform: translateY(-50%);
}

.tree-search-input {
  width: 100%;
  max-width: 100%;
  line-height: 2;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  font-size: inherit;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  padding-left: 26px;
  padding-right: 30px;
}

.tree-search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.tree-search-input:focus {
  outline: none;
  border-color: var(--tt-brand-color-500);
}

.tree-search-input::selection {
  background: var(--tt-brand-color-500);
  color: #fff;
}

@media (max-width: 768px) {
  .sidebar-header kbd {
    display: none;
  }
}
</style>
