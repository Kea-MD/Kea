import { onUnmounted, ref } from 'vue'

export function useSidebarInteraction() {
  const sidebarOpen = ref(false)
  const sidebarHovering = ref(false)
  const hoverDisabled = ref(false)

  let hoverTimeout: ReturnType<typeof setTimeout> | null = null

  const toggleSidebar = () => {
    const wasOpen = sidebarOpen.value
    sidebarOpen.value = !sidebarOpen.value

    if (!wasOpen) return

    hoverDisabled.value = true
    sidebarHovering.value = false

    window.setTimeout(() => {
      hoverDisabled.value = false
    }, 300)
  }

  const handleSidebarHover = (hovering: boolean) => {
    if (hoverDisabled.value) return

    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = null
    }

    if (hovering) {
      sidebarHovering.value = true
      return
    }

    hoverTimeout = window.setTimeout(() => {
      sidebarHovering.value = false
    }, 200)
  }

  onUnmounted(() => {
    if (!hoverTimeout) return
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  })

  return {
    sidebarOpen,
    sidebarHovering,
    toggleSidebar,
    handleSidebarHover,
  }
}
