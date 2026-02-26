import { onMounted, onUnmounted, ref } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { dispatchEditorCommand, type EditorCommand, type EditorMode } from '../../modules/editor/editorCommands'
import { useDocumentStore } from '../../modules/editor/state/documentStore'
import { useWorkspaceStore } from '../../modules/workspace/state/workspaceStore'

type MenuAction =
  | 'new_file'
  | 'open_file'
  | 'open_folder'
  | 'save'
  | 'save_as'
  | 'close_tab'
  | 'toggle_sidebar'
  | 'quick_open'
  | 'undo'
  | 'redo'
  | 'find'
  | 'toggle_editor_mode'
  | 'open_settings'

interface UseEditorAppActionsOptions {
  toggleSidebar: () => void
}

export function useEditorAppActions(options: UseEditorAppActionsOptions) {
  const documentStore = useDocumentStore()
  const workspaceStore = useWorkspaceStore()

  const showQuickSwitcher = ref(false)
  const showSettingsDialog = ref(false)

  let unlistenMenu: (() => void) | null = null

  const openQuickSwitcher = () => {
    showQuickSwitcher.value = true
  }

  const openSettings = () => {
    showSettingsDialog.value = true
  }

  const executeMenuAction = (action: MenuAction) => {
    switch (action) {
      case 'new_file':
        documentStore.newFile()
        break
      case 'open_file':
        void documentStore.openFileDialog()
        break
      case 'open_folder':
        void workspaceStore.openFolder()
        break
      case 'save':
        void documentStore.saveFile()
        break
      case 'save_as':
        void documentStore.saveFileAs()
        break
      case 'close_tab':
        if (documentStore.activeDocumentId) {
          void documentStore.closeDocument(documentStore.activeDocumentId)
        }
        break
      case 'toggle_sidebar':
        options.toggleSidebar()
        break
      case 'quick_open':
        openQuickSwitcher()
        break
      case 'undo':
        dispatchEditorCommand('undo')
        break
      case 'redo':
        dispatchEditorCommand('redo')
        break
      case 'find':
        dispatchEditorCommand('find')
        break
      case 'toggle_editor_mode':
        documentStore.toggleEditorMode()
        break
      case 'open_settings':
        openSettings()
        break
      default:
        break
    }
  }

  const handleMenuAction = (action: string) => {
    executeMenuAction(action as MenuAction)
  }

  const setupMenuListener = async () => {
    unlistenMenu = await listen<string>('menu-event', (event) => {
      handleMenuAction(event.payload)
    })
  }

  const handleKeydown = (event: KeyboardEvent) => {
    const isMod = event.metaKey || event.ctrlKey

    if (isMod && event.key.toLowerCase() === 'p') {
      event.preventDefault()
      openQuickSwitcher()
      return
    }

    if (isMod && event.key.toLowerCase() === 'e') {
      event.preventDefault()
      documentStore.toggleEditorMode()
    }
  }

  const closeQuickSwitcher = () => {
    showQuickSwitcher.value = false
  }

  const closeSettings = () => {
    showSettingsDialog.value = false
  }

  const handleNewRequest = () => {
    documentStore.newFile()
  }

  const handleFeedback = () => {
    console.log('Feedback')
  }

  const handleSettings = () => {
    openSettings()
  }

  const handleEditorCommand = (command: EditorCommand) => {
    dispatchEditorCommand(command)
  }

  const handleEditorMode = (mode: EditorMode) => {
    documentStore.setEditorMode(mode)
  }

  onMounted(() => {
    void setupMenuListener()
    documentStore.loadRecentFiles()
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    unlistenMenu?.()
    window.removeEventListener('keydown', handleKeydown)
  })

  return {
    showQuickSwitcher,
    showSettingsDialog,
    closeQuickSwitcher,
    closeSettings,
    handleNewRequest,
    handleFeedback,
    handleSettings,
    handleEditorCommand,
    handleEditorMode,
  }
}
