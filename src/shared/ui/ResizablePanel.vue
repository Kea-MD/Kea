<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  onResize?: (width: number) => void
  showResizeHandle?: boolean
  resizeFrom?: 'right' | 'left'
  snapToDefault?: boolean
  snapThreshold?: number
  snapPoints?: number[]
}

const props = withDefaults(defineProps<Props>(), {
  defaultWidth: 400,
  minWidth: 30,
  maxWidth: 600,
  showResizeHandle: true,
  resizeFrom: 'right',
  snapToDefault: true,
  snapThreshold: 30
})

const width = ref(props.defaultWidth)
const isDragging = ref(false)
const panelRef = ref<HTMLDivElement | null>(null)
const startXRef = ref(0)
const startWidthRef = ref(0)

const handleMouseDown = (e: MouseEvent) => {
  isDragging.value = true
  startXRef.value = e.clientX
  startWidthRef.value = width.value
  e.preventDefault()
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return

  const deltaX = e.clientX - startXRef.value
  const widthDelta = props.resizeFrom === 'right' ? deltaX : -deltaX
  let newWidth = Math.max(
    props.minWidth,
    Math.min(props.maxWidth, startWidthRef.value + widthDelta)
  )

  // Implement snapping logic
  const snapTargets = props.snapPoints || (props.snapToDefault ? [props.defaultWidth] : [])
  for (const snapPoint of snapTargets) {
    if (Math.abs(newWidth - snapPoint) <= props.snapThreshold) {
      newWidth = snapPoint
      break
    }
  }

  width.value = newWidth
  props.onResize?.(newWidth)
}

const handleMouseUp = () => {
  isDragging.value = false
}

onMounted(() => {
  if (isDragging.value) {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})

// Watch for dragging state changes
watch(isDragging, (newValue) => {
  if (newValue) {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  } else {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
})
</script>

<template>
  <div
    ref="panelRef"
    class="resizable-panel"
    :style="{ width: `${width}px` }"
  >
    <slot />
    <button
      v-if="showResizeHandle"
      type="button"
      class="resize-handle"
      :data-resize-from="resizeFrom"
      @mousedown="handleMouseDown"
      aria-label="Resize panel"
      title="Resize panel"
      tabindex="-1"
    ></button>
  </div>
</template>

<style scoped>
.resizable-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  flex-shrink: 0;
}

.resize-handle {
  position: absolute;
  top: 0%;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
  border: none;
  padding: 0;
  z-index: 10;
}

/* Position based on resizeFrom prop */
.resize-handle[data-resize-from="right"] {
  right: 0;
}

.resize-handle[data-resize-from="left"] {
  left: 0;
}
</style>
