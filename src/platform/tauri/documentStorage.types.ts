export interface OpenedDocumentData {
  path: string
  content: string
  name: string
}

export interface SaveDocumentAsResult {
  path: string
  name: string
}

export interface DocumentStoragePort {
  readFile: (path: string) => Promise<OpenedDocumentData>
  openMarkdownFile: () => Promise<OpenedDocumentData>
  saveMarkdownFile: (path: string, content: string) => Promise<void>
  saveMarkdownFileAs: (content: string) => Promise<SaveDocumentAsResult>
}
