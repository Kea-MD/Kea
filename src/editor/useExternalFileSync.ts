import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { DocumentSnapshot } from '../core/contracts/document'
import type { FileWatchEvent } from '../core/contracts/fileWatch'
import { tauriFileWatchPort } from '../platform/tauri/fileWatch'

export function useExternalFileSync(
  documents: DocumentSnapshot[],
  enabled: boolean,
  onExternalChange: (path: string, kind: FileWatchEvent['kind']) => Promise<void>,
): void {
  const watchedPaths = useRef(new Set<string>())
  const onExternalChangeRef = useRef(onExternalChange)
  onExternalChangeRef.current = onExternalChange

  useEffect(() => {
    if (!enabled) return

    let disposed = false
    let unlisten: (() => void) | undefined
    void listen<FileWatchEvent>('file-watch-event', event => {
      void onExternalChangeRef.current(event.payload.path, event.payload.kind)
    }).then(removeListener => {
      if (disposed) removeListener()
      else unlisten = removeListener
    }).catch(error => console.error('Failed to listen for external file changes:', error))

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const nextPaths = new Set(documents.map(document => document.path).filter(Boolean))

    for (const path of nextPaths) {
      if (watchedPaths.current.has(path)) continue
      watchedPaths.current.add(path)
      void tauriFileWatchPort.startFileWatch(path).catch(error => {
        watchedPaths.current.delete(path)
        console.error(`Failed to watch ${path}:`, error)
      })
    }

    for (const path of watchedPaths.current) {
      if (nextPaths.has(path)) continue
      watchedPaths.current.delete(path)
      void tauriFileWatchPort.stopFileWatch(path).catch(error => console.error(`Failed to stop watching ${path}:`, error))
    }
  }, [documents, enabled])

  useEffect(() => () => {
    for (const path of watchedPaths.current) {
      void tauriFileWatchPort.stopFileWatch(path).catch(error => console.error(`Failed to stop watching ${path}:`, error))
    }
    watchedPaths.current.clear()
  }, [])
}
