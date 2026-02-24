export interface FileWatchPort {
  startFileWatch: (path: string) => Promise<void>
  stopFileWatch: (path: string) => Promise<void>
  stopAllFileWatches: () => Promise<void>
}
