import { watch, onUnmounted, ref } from 'vue'
import { useDocumentStore } from '../stores/documentStore'
import { useDebounceFn } from '@vueuse/core'

export function useAutoSave(intervalMs = 2000) {
  const documentStore = useDocumentStore()
  const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const lastSaveError = ref<string | null>(null)

  const debouncedSave = useDebounceFn(async () => {
    // Only auto-save if file has path and has unsaved changes
    if (documentStore.hasUnsavedChanges && documentStore.currentFile?.path) {
      try {
        saveStatus.value = 'saving'
        await documentStore.saveFile()
        saveStatus.value = 'saved'
        lastSaveError.value = null
        
        // Reset to idle after 2 seconds
        setTimeout(() => {
          if (saveStatus.value === 'saved') {
            saveStatus.value = 'idle'
          }
        }, 2000)
      } catch (error) {
        saveStatus.value = 'error'
        lastSaveError.value = error instanceof Error ? error.message : 'Failed to save'
        console.error('Auto-save failed:', error)
      }
    }
  }, intervalMs)

  // Watch for content changes
  const stopWatch = watch(
    () => documentStore.currentFile?.content,
    () => {
      if (documentStore.currentFile?.path && documentStore.hasUnsavedChanges) {
        debouncedSave()
      }
    }
  )

  // Cleanup on unmount
  onUnmounted(() => {
    stopWatch()
  })

  return {
    saveStatus,
    lastSaveError,
  }
}