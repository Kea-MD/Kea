import { convertFileSrc } from '@tauri-apps/api/core'
import type { Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'

function directoryOf(path: string): string {
  const separator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return separator >= 0 ? path.slice(0, separator) : ''
}

function resolveImage(image: HTMLImageElement, documentPath: string): void {
  const raw = image.getAttribute('src')
  if (!raw || /^(?:https?:|asset:|data:|blob:)/i.test(raw)) return
  let decoded = raw.replace(/^<|>$/g, '')
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    // Keep malformed percent escapes literal instead of breaking the editor.
  }
  const absolute = decoded.startsWith('/') ? decoded : `${directoryOf(documentPath)}/${decoded}`
  image.src = convertFileSrc(absolute)
}

export function localImageExtension(getDocumentPath: () => string): Extension {
  return ViewPlugin.fromClass(class {
    private readonly observer: MutationObserver

    constructor(view: EditorView) {
      const fix = (root: ParentNode): void => {
        const path = getDocumentPath()
        if (!path) return
        root.querySelectorAll('img').forEach(image => resolveImage(image, path))
      }

      fix(view.dom)
      this.observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
          const path = getDocumentPath()
          if (!path) return
          if (node instanceof HTMLImageElement) resolveImage(node, path)
          else if (node instanceof HTMLElement) fix(node)
        }))
      })
      this.observer.observe(view.dom, { childList: true, subtree: true })
    }

    destroy(): void {
      this.observer.disconnect()
    }
  })
}
