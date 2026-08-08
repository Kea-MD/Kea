export type FileWatchEventKind = 'modified' | 'removed'

export interface FileWatchEvent {
  kind: FileWatchEventKind
  path: string
}

export interface FileWatchPort {
  startFileWatch: (path: string) => Promise<void>
  stopFileWatch: (path: string) => Promise<void>
  stopAllFileWatches: () => Promise<void>
}
