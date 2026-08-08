export type DocumentCommandSource = 'local' | 'external' | 'remote'

export type DocumentCommandType =
  | 'openDocument'
  | 'switchDocument'
  | 'closeDocument'
  | 'closeAllDocuments'
  | 'createDocument'
  | 'updateContent'
  | 'applyExternalEdit'
  | 'saveDocument'
  | 'saveDocumentAs'

export interface DocumentCommand {
  type: DocumentCommandType
  source: DocumentCommandSource
  documentId?: string
  path?: string
  contentLength?: number
}
