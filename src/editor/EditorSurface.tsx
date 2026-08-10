import { memo } from 'react'
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

function EditorSurfaceComponent({ document, onChange, onEditorChange, onEditorStateChange, onOpenLink }: EditorSurfaceProps) {
  return (
    <section className="react-editor-surface" aria-label="Markdown editor" data-testid="react-prosemark-editor">
      <ProseMarkEditor
        documentId={document.id}
        documentPath={document.path}
        content={document.content}
        contentRevision={document.contentRevision}
        onChange={onChange}
        onEditorChange={onEditorChange}
        onEditorStateChange={onEditorStateChange}
        onOpenLink={onOpenLink}
      />
    </section>
  )
}

export const EditorSurface = memo(EditorSurfaceComponent, (previous, next) => (
  previous.document.id === next.document.id
  && previous.document.path === next.document.path
  && previous.document.contentRevision === next.document.contentRevision
  && previous.onChange === next.onChange
  && previous.onEditorChange === next.onEditorChange
  && previous.onEditorStateChange === next.onEditorStateChange
  && previous.onOpenLink === next.onOpenLink
))
