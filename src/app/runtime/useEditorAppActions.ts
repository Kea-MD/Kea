import { onMounted, onUnmounted, ref } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { dispatchEditorCommand, type EditorCommand, type EditorMode } from '../../modules/editor/editorCommands'
import { useDocumentStore } from '../../modules/editor/state/documentStore'
import {
  isShortcutAction,
  resolveShortcutAction,
  type ShortcutActionId,
} from '../../modules/settings/shortcuts/shortcutRegistry'
import { useSettingsStore } from '../../modules/settings/state/settingsStore'
import { useWorkspaceStore } from '../../modules/workspace/state/workspaceStore'

interface UseEditorAppActionsOptions {
  toggleSidebar: () => void
}

export function useEditorAppActions(options: UseEditorAppActionsOptions) {
  const documentStore = useDocumentStore()
  const settingsStore = useSettingsStore()
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

  const executeShortcutAction = (action: ShortcutActionId) => {
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
    if (!isShortcutAction(action)) {
      return
    }

    executeShortcutAction(action)
  }

  const setupMenuListener = async () => {
    unlistenMenu = await listen<string>('menu-event', (event) => {
      handleMenuAction(event.payload)
    })
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (settingsStore.isCapturingShortcut) {
      return
    }

    const action = resolveShortcutAction(event, settingsStore.shortcuts)
    if (action) {
      event.preventDefault()
      executeShortcutAction(action)
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
