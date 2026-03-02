import { onMounted, onUnmounted, watch } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { useDocumentStore } from '../../editor/state/documentStore'
import { tauriFileWatchPort } from '../../../platform/tauri/fileWatch'
import { isTauriRuntime } from '../../../shared/platform/runtime'

interface FileWatchEventPayload {
  path: string
  kind: 'modified' | 'removed'
}

export function useExternalFileSync() {
  const isTauri = isTauriRuntime()
  const documentStore = useDocumentStore()
  let unlistenFileWatch: (() => void) | null = null
  let stopActivePathWatch: (() => void) | null = null
  let currentWatchPath: string | null = null

  const updateWatchPath = async (nextPath: string | null) => {
    if (currentWatchPath && currentWatchPath !== nextPath) {
      try {
        await tauriFileWatchPort.stopFileWatch(currentWatchPath)
      } catch (error) {
        console.error('Failed to stop file watch:', error)
      }
      currentWatchPath = null
    }

    if (nextPath && nextPath !== currentWatchPath) {
      try {
        await tauriFileWatchPort.startFileWatch(nextPath)
        currentWatchPath = nextPath
      } catch (error) {
        console.error('Failed to start file watch:', error)
      }
    }
  }

  onMounted(() => {
    if (!isTauri) {
      return
    }

    stopActivePathWatch = watch(
      () => documentStore.activeDocument?.path ?? null,
      (path) => {
        updateWatchPath(path && path.length > 0 ? path : null)
      },
      { immediate: true }
    )

    listen<FileWatchEventPayload>('file-watch-event', (event) => {
      const activePath = documentStore.activeDocument?.path
      if (!activePath || event.payload.path !== activePath) {
        return
      }

      if (event.payload.kind === 'modified' || event.payload.kind === 'removed') {
        documentStore.checkActiveDocumentExternalChange()
      }
    })
      .then((unlisten) => {
        unlistenFileWatch = unlisten
      })
      .catch((error) => {
        console.error('Failed to listen for file watch events:', error)
      })

    documentStore.checkActiveDocumentExternalChange()
  })

  onUnmounted(() => {
    if (!isTauri) {
      return
    }

    unlistenFileWatch?.()
    unlistenFileWatch = null

    stopActivePathWatch?.()
    stopActivePathWatch = null

    tauriFileWatchPort.stopAllFileWatches().catch((error: unknown) => {
      console.error('Failed to stop file watches:', error)
    })
  })
}
