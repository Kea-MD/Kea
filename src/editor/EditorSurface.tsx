import type { DocumentSnapshot } from '../core/contracts/document'
import type { EditorController } from '../core/contracts/editor'
import { ProseMarkEditor } from './ProseMarkEditor'

export interface EditorSurfaceProps {
  document: DocumentSnapshot
  onChange: (content: string) => void
  onEditorChange: (editor: EditorController | null) => void
  onEditorStateChange: () => void
  onOpenLink: (url: string) => void
}

export function EditorSurface({ document, onChange, onEditorChange, onEditorStateChange, onOpenLink }: EditorSurfaceProps) {
  return (
    <section className="react-editor-surface" aria-label="Markdown editor" data-testid="react-prosemark-editor">
      <ProseMarkEditor
        documentId={document.id}
        documentPath={document.path}
        content={document.content}
        onChange={onChange}
        onEditorChange={onEditorChange}
        onEditorStateChange={onEditorStateChange}
        onOpenLink={onOpenLink}
      />
    </section>
  )
}
