<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'

const props = defineProps<{
  editor: Editor | null | undefined
  levels?: (1 | 2 | 3 | 4 | 5 | 6)[]
}>()

const levels = computed(() => props.levels ?? [1, 2, 3])
const isOpen = ref(false)

const activeLevel = computed(() => {
  if (!props.editor) return null
  for (const level of levels.value) {
    if (props.editor.isActive('heading', { level })) {
      return level
    }
  }
  return null
})

const currentLabel = computed(() => {
  if (activeLevel.value) {
    return `H${activeLevel.value}`
  }
  return 'Text'
})

function toggleHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  if (!props.editor) return
  props.editor.chain().focus().toggleHeading({ level }).run()
  isOpen.value = false
}

function setParagraph() {
  if (!props.editor) return
  props.editor.chain().focus().setParagraph().run()
  isOpen.value = false
}

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function closeDropdown() {
  isOpen.value = false
}
</script>

<template>
  <div class="heading-dropdown" v-if="editor">
    <button 
      class="dropdown-trigger"
      @click="toggleDropdown"
      :class="{ active: activeLevel !== null }"
    >
      <span class="label">{{ currentLabel }}</span>
      <svg 
        class="chevron" 
        :class="{ open: isOpen }"
        width="12" 
        height="12" 
        viewBox="0 0 12 12" 
        fill="none"
      >
        <path 
          d="M3 4.5L6 7.5L9 4.5" 
          stroke="currentColor" 
          stroke-width="1.5" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-menu" @mouseleave="closeDropdown">
        <button 
          class="dropdown-item"
          :class="{ active: !activeLevel }"
          @click="setParagraph"
        >
          <span class="item-icon">¶</span>
          <span class="item-label">Paragraph</span>
          <span class="item-shortcut">⌘⌥0</span>
        </button>
        
        <button 
          v-for="level in levels"
          :key="level"
          class="dropdown-item"
          :class="{ active: activeLevel === level }"
          @click="toggleHeading(level)"
        >
          <span class="item-icon heading-icon" :data-level="level">H{{ level }}</span>
          <span class="item-label">Heading {{ level }}</span>
          <span class="item-shortcut">⌘⌥{{ level }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.heading-dropdown {
  position: relative;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 70px;
  justify-content: space-between;
}

.dropdown-trigger:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.dropdown-trigger.active {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.95);
}

.chevron {
  transition: transform 0.2s ease;
}

.chevron.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 180px;
  background: rgba(30, 30, 30, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.1s ease;
  text-align: left;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.dropdown-item.active {
  background: rgba(255, 255, 255, 0.12);
  color: white;
}

.item-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.heading-icon {
  font-size: 11px;
}

.heading-icon[data-level="1"] {
  font-size: 13px;
}

.heading-icon[data-level="2"] {
  font-size: 12px;
}

.dropdown-item.active .item-icon {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
}

.item-label {
  flex: 1;
}

.item-shortcut {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  font-family: system-ui, -apple-system, sans-serif;
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

