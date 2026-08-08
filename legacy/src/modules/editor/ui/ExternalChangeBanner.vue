<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentStore } from '../state/documentStore'

const documentStore = useDocumentStore()

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
</script>

<template>
  <div v-if="hasExternalChange" class="external-change-banner" role="status">
    <span class="banner-text">
      <strong>{{ externalChangePath }}</strong>
      changed on disk.
    </span>
    <div class="banner-actions">
      <button class="banner-btn secondary" @click="keepLocalVersion" title="Keep local">
        Keep local
      </button>
      <button class="banner-btn" @click="acceptExternalChange" title="Reload disk">
        Reload disk
      </button>
    </div>
  </div>
</template>

<style scoped>
.external-change-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(var(--tt-brand-color-rgb), 0.16);
  border-bottom: 1px solid rgba(var(--tt-brand-color-rgb), 0.35);
}

.dark .external-change-banner {
  background: rgba(var(--tt-brand-color-rgb), 0.24);
  border-bottom-color: rgba(var(--tt-brand-color-rgb), 0.45);
}

.banner-text {
  font-size: 12px;
  color: var(--tt-gray-light-700);
}

.dark .banner-text {
  color: var(--tt-gray-light-50);
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
  background: rgba(var(--tt-brand-color-rgb), 0.9);
  color: white;
}

.banner-btn.secondary {
  background: rgba(0, 0, 0, 0.15);
  color: var(--tt-gray-light-700);
}

.dark .banner-btn.secondary {
  background: rgba(255, 255, 255, 0.12);
  color: var(--tt-gray-light-50);
}

.banner-btn:hover {
  filter: brightness(1.05);
}
</style>
