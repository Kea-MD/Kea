import { invoke } from '@tauri-apps/api/core'
import type {
  DocumentStoragePort,
  OpenedDocumentData,
  SaveDocumentAsResult,
} from './documentStorage.types'

export const tauriDocumentStoragePort: DocumentStoragePort = {
  readFile(path: string): Promise<OpenedDocumentData> {
    return invoke<OpenedDocumentData>('read_file', { path })
  },

  openMarkdownFile(): Promise<OpenedDocumentData> {
    return invoke<OpenedDocumentData>('open_markdown_file')
  },

  saveMarkdownFile(path: string, content: string): Promise<void> {
    return invoke('save_markdown_file', {
      path,
      content,
    })
  },

  saveMarkdownFileAs(content: string): Promise<SaveDocumentAsResult> {
    return invoke<SaveDocumentAsResult>('save_markdown_file_as', {
      content,
    })
  },
}
