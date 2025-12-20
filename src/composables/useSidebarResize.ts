import { ref, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY = 'orca-sidebar-width'
const DEFAULT_WIDTH = 260
const MIN_WIDTH = 200
const MAX_WIDTH = 500

// Shared state across all instances
const sidebarWidth = ref(DEFAULT_WIDTH)
const isResizing = ref(false)

export function useSidebarResize() {
  let startX = 0
  let startWidth = 0

  const loadSavedWidth = () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const width = parseInt(saved, 10)
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
        sidebarWidth.value = width
      }
    }
  }

  const saveWidth = () => {
    localStorage.setItem(STORAGE_KEY, String(sidebarWidth.value))
  }

  const startResize = (e: MouseEvent) => {
    e.preventDefault()
    isResizing.value = true
    startX = e.clientX
    startWidth = sidebarWidth.value

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResize)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return

    const delta = e.clientX - startX
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
    sidebarWidth.value = newWidth
  }

  const stopResize = () => {
    if (!isResizing.value) return

    isResizing.value = false
    saveWidth()

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  onMounted(() => {
    loadSavedWidth()
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResize)
  })

  return {
    sidebarWidth,
    isResizing,
    startResize,
    MIN_WIDTH,
    MAX_WIDTH,
    DEFAULT_WIDTH
  }
}
