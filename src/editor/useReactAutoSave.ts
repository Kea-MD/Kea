import { useEffect, useRef } from 'react'
import type { DocumentSnapshot } from '../core/contracts/document'

export function useReactAutoSave(
  document: DocumentSnapshot | null,
  saveFile: () => Promise<boolean>,
  intervalMs = 2000,
): void {
  const saveFileRef = useRef(saveFile)

  useEffect(() => {
    saveFileRef.current = saveFile
  }, [saveFile])

  useEffect(() => {
    if (!document?.path || !document.isDirty) return

    const timeout = window.setTimeout(() => {
      void saveFileRef.current()
    }, intervalMs)

    return () => window.clearTimeout(timeout)
  }, [document?.content, document?.id, document?.isDirty, document?.path, document?.savedContent, intervalMs])
}
