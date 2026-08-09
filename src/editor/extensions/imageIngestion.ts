import { Prec, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { DocumentAssetPort } from '../../core/contracts/assets'
import { tauriDocumentAssetPort } from '../../platform/tauri/documentAssets'

function imageFiles(list: FileList | null): File[] {
  return list ? Array.from(list).filter(file => file.type.startsWith('image/')) : []
}

function altText(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'image'
}

export function imageIngestionExtension(
  getDocumentPath: () => string,
  onError: (message: string) => void,
  port: DocumentAssetPort = tauriDocumentAssetPort,
): Extension {
  const ingest = async (view: EditorView, files: File[], position: number): Promise<void> => {
    const documentPath = getDocumentPath()
    if (!documentPath) {
      onError('Save this document before adding images.')
      return
    }
    try {
      const markdown: string[] = []
      for (const file of files) {
        const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
        const stored = await port.storeImage(documentPath, file.name, bytes)
        markdown.push(`![${altText(file.name)}](${stored.relativePath})`)
      }
      const insert = markdown.join('\n\n')
      const cursor = Math.min(position, view.state.doc.length)
      view.dispatch({ changes: { from: cursor, insert }, selection: { anchor: cursor + insert.length }, userEvent: 'input.drop.image' })
      view.focus()
      onError('')
    } catch (error) {
      console.error('Failed to add image:', error)
      onError(`Failed to add image: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return Prec.highest(EditorView.domEventHandlers({
    paste(event, view) {
      const files = imageFiles(event.clipboardData?.files ?? null)
      if (!files.length) return false
      event.preventDefault()
      void ingest(view, files, view.state.selection.main.from)
      return true
    },
    drop(event, view) {
      const files = imageFiles(event.dataTransfer?.files ?? null)
      if (!files.length) return false
      event.preventDefault()
      const position = view.posAtCoords(event) ?? view.state.selection.main.from
      void ingest(view, files, position)
      return true
    },
  }))
}
