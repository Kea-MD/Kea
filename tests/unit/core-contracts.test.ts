import { describe, expect, it } from 'vitest'
import type {
  DocumentSnapshot,
  EditorCommandEventDetail,
  FileWatchEvent,
  KeaError,
  SettingsSnapshot,
  WorkspaceFileEntry,
} from '../../src/core/contracts'

describe('framework-neutral contracts', () => {
  it('represents document, workspace, watcher, settings, editor, and errors', () => {
    const document: DocumentSnapshot = { id: 'doc', path: '', name: 'Untitled', content: '', savedContent: '', isDirty: false }
    const entry: WorkspaceFileEntry = { name: 'Readme.md', path: '/Readme.md', is_dir: false, is_markdown: true }
    const watch: FileWatchEvent = { kind: 'modified', path: entry.path }
    const command: EditorCommandEventDetail = { command: 'bold' }
    const settings: SettingsSnapshot = { restoreWorkspaceOnLaunch: true, edgeGlowEnabled: false, shortcuts: {} }
    const error: KeaError = { code: 'cancelled', message: 'Cancelled' }
    expect({ document, entry, watch, command, settings, error }).toBeTruthy()
  })
})
