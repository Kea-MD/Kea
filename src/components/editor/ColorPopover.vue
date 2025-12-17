<script setup lang="ts">
import { ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import Popover from 'primevue/popover'
import Button from 'primevue/button'

interface Props {
  editor: Editor | undefined
}

const props = defineProps<Props>()

const popover = ref()

// Highlight color options using CSS variables
const highlightColors = [
  { name: 'Yellow', value: 'yellow', cssVar: '--tt-color-highlight-yellow' },
  { name: 'Green', value: 'green', cssVar: '--tt-color-highlight-green' },
  { name: 'Blue', value: 'blue', cssVar: '--tt-color-highlight-blue' },
  { name: 'Purple', value: 'purple', cssVar: '--tt-color-highlight-purple' },
  { name: 'Red', value: 'red', cssVar: '--tt-color-highlight-red' },
  { name: 'Gray', value: 'gray', cssVar: '--tt-color-highlight-gray' },
  { name: 'Orange', value: 'orange', cssVar: '--tt-color-highlight-orange' },
  { name: 'Pink', value: 'pink', cssVar: '--tt-color-highlight-pink' },
]

// Text color options
const textColors = [
  { name: 'Gray', value: 'gray', cssVar: '--tt-color-text-gray' },
  { name: 'Orange', value: 'orange', cssVar: '--tt-color-text-orange' },
  { name: 'Yellow', value: 'yellow', cssVar: '--tt-color-text-yellow' },
  { name: 'Green', value: 'green', cssVar: '--tt-color-text-green' },
  { name: 'Blue', value: 'blue', cssVar: '--tt-color-text-blue' },
  { name: 'Purple', value: 'purple', cssVar: '--tt-color-text-purple' },
  { name: 'Pink', value: 'pink', cssVar: '--tt-color-text-pink' },
  { name: 'Red', value: 'red', cssVar: '--tt-color-text-red' },
]

const toggle = (event: Event) => {
  popover.value?.toggle(event)
}

const setHighlightColor = (color: typeof highlightColors[0]) => {
  if (!props.editor) return
  
  // Get the actual CSS variable value
  const cssValue = getComputedStyle(document.documentElement).getPropertyValue(color.cssVar).trim()
  
  props.editor.chain().focus().toggleHighlight({ color: cssValue }).run()
  popover.value?.hide()
}

const setTextColor = (color: typeof textColors[0]) => {
  if (!props.editor) return
  
  // Get the actual CSS variable value
  const cssValue = getComputedStyle(document.documentElement).getPropertyValue(color.cssVar).trim()
  
  props.editor.chain().focus().setColor(cssValue).run()
  popover.value?.hide()
}

const clearHighlight = () => {
  if (!props.editor) return
  props.editor.chain().focus().unsetHighlight().run()
  popover.value?.hide()
}

const clearTextColor = () => {
  if (!props.editor) return
  props.editor.chain().focus().unsetColor().run()
  popover.value?.hide()
}

defineExpose({ toggle })
</script>

<template>
  <Popover ref="popover">
    <div class="color-popover">
      <!-- Highlight Colors -->
      <div class="color-section">
        <div class="color-section-header">
          <span class="color-section-title">Highlight</span>
          <Button
            icon="pi pi-times"
            size="small"
            text
            rounded
            severity="secondary"
            @click="clearHighlight"
            v-tooltip.top="'Clear Highlight'"
          />
        </div>
        <div class="color-grid">
          <button
            v-for="color in highlightColors"
            :key="color.value"
            class="color-swatch"
            :style="{ backgroundColor: `var(${color.cssVar})` }"
            :title="color.name"
            @click="setHighlightColor(color)"
          />
        </div>
      </div>

      <!-- Text Colors -->
      <div class="color-section">
        <div class="color-section-header">
          <span class="color-section-title">Text Color</span>
          <Button
            icon="pi pi-times"
            size="small"
            text
            rounded
            severity="secondary"
            @click="clearTextColor"
            v-tooltip.top="'Clear Color'"
          />
        </div>
        <div class="color-grid">
          <button
            v-for="color in textColors"
            :key="color.value"
            class="color-swatch text-color-swatch"
            :title="color.name"
            @click="setTextColor(color)"
          >
            <span class="text-color-preview" :style="{ color: `var(${color.cssVar})` }">A</span>
          </button>
        </div>
      </div>
    </div>
  </Popover>
</template>

<style scoped>
.color-popover {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.5rem;
  min-width: 200px;
}

.color-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.color-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.color-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--tt-gray-light-500);
}

.dark .color-section-title {
  color: var(--tt-gray-dark-500);
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.375rem;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-swatch:hover {
  transform: scale(1.1);
  border-color: var(--tt-brand-color-500);
}

.text-color-swatch {
  background-color: var(--tt-bg-color);
  border: 1px solid var(--tt-border-color);
}

.text-color-preview {
  font-weight: 700;
  font-size: 14px;
}
</style>

