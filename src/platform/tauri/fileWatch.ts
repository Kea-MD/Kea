import { invoke } from '@tauri-apps/api/core'
import type { FileWatchPort } from './fileWatch.types'

export const tauriFileWatchPort: FileWatchPort = {
  startFileWatch(path: string): Promise<void> {
    return invoke('start_file_watch', { path })
  },

  stopFileWatch(path: string): Promise<void> {
    return invoke('stop_file_watch', { path })
  },

  stopAllFileWatches(): Promise<void> {
    return invoke('stop_all_file_watches')
  },
}
