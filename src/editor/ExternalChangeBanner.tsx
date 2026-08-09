import type { ExternalDocumentChange } from '../core/contracts/document'

export function ExternalChangeBanner({
  change,
  documentName,
  onAccept,
  onKeepLocal,
}: {
  change: ExternalDocumentChange
  documentName: string
  onAccept: () => void
  onKeepLocal: () => void
}) {
  const removed = change.kind === 'removed'
  return (
    <div className="flex flex-none items-center gap-3 border-b border-[var(--react-border)] bg-[color-mix(in_srgb,var(--react-panel-background)_88%,#e9a23b)] px-4 py-2 text-xs text-[var(--react-dark-700)]" role="alert">
      <span className="material-symbols-outlined !text-[18px]" aria-hidden="true">{removed ? 'file_copy_off' : 'sync_problem'}</span>
      <span className="min-w-0 flex-1 truncate">
        {removed ? `${documentName} was removed from disk.` : `${documentName} changed outside Kea.`}
      </span>
      <button type="button" className="rounded-md border border-[var(--react-border)] bg-transparent px-2.5 py-1 hover:bg-[var(--react-hover-background)]" onClick={onKeepLocal}>
        {removed ? 'Keep editing' : 'Keep local'}
      </button>
      <button type="button" className="rounded-md border-0 bg-[rgb(var(--react-brand-rgb))] px-2.5 py-1 text-white" onClick={onAccept}>
        {removed ? 'Close tab' : 'Reload disk'}
      </button>
    </div>
  )
}
