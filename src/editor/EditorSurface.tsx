import type { DocumentSnapshot } from '../core/contracts/document'
import type { EditorMode } from '../core/contracts/editor'
import { CodeMirrorEditor } from './CodeMirrorEditor'
import { MilkdownEditor } from './MilkdownEditor'

export interface EditorSurfaceProps {
  document: DocumentSnapshot
  mode: EditorMode
  onChange: (content: string) => void
  onOpenFile?: () => void
}

export function EditorSurface({ document, mode, onChange, onOpenFile }: EditorSurfaceProps) {
  if (mode === 'source') {
    return (
      <section className="react-editor-surface" aria-label="Source editor">
        <CodeMirrorEditor documentId={document.id} content={document.content} onChange={onChange} />
      </section>
    )
  }

  return (
    <section className="react-editor-surface" aria-label="Rendered editor">
      <MilkdownEditor documentId={document.id} content={document.content} onChange={onChange} />
      {onOpenFile && <button type="button" className="absolute bottom-5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-lg border-0 bg-[var(--react-dark-200)] px-4 py-2.5 text-[13px] font-medium text-[var(--react-dark-700)] opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" onClick={onOpenFile}><span className="material-symbols-outlined" aria-hidden="true">description</span>Open File</button>}
    </section>
  )
}
