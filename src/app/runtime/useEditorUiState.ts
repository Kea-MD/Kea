import { onMounted, onUnmounted, ref } from 'vue'
import { addEditorUiStateListener } from '../../modules/editor/editorCommands'

export function useEditorUiState() {
  const isFindOpen = ref(false)
  const canUndo = ref(false)
  const canRedo = ref(false)

  let removeEditorUiStateListener: (() => void) | null = null

  onMounted(() => {
    removeEditorUiStateListener = addEditorUiStateListener(
      ({ findOpen, canUndo: nextCanUndo, canRedo: nextCanRedo }) => {
        if (typeof findOpen === 'boolean') {
          isFindOpen.value = findOpen
        }

        if (typeof nextCanUndo === 'boolean') {
          canUndo.value = nextCanUndo
        }

        if (typeof nextCanRedo === 'boolean') {
          canRedo.value = nextCanRedo
        }
      }
    )
  })

  onUnmounted(() => {
    removeEditorUiStateListener?.()
    removeEditorUiStateListener = null
  })

  return {
    isFindOpen,
    canUndo,
    canRedo,
  }
}
