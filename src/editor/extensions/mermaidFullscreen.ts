import { mountMermaidCanvas } from './mermaidCanvas'
import { renderMermaid } from './mermaidRenderer'

export function openMermaidFullscreen(source: string, ariaLabel: string): void {
  const rendered = renderMermaid(source)
  if (!rendered.svg) return

  const overlay = document.createElement('div')
  overlay.className = 'cm-mermaid-fullscreen select-none'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', ariaLabel)
  overlay.tabIndex = -1
  const themeSource = document.querySelector<HTMLElement>('.prosemark-editor-shell')
  if (themeSource) {
    const styles = getComputedStyle(themeSource)
    for (const property of ['--bg-base', '--fg-base', '--border-color', '--surface-card', '--surface-subtle', '--text-primary', '--text-secondary', '--text-error', '--accent']) {
      overlay.style.setProperty(property, styles.getPropertyValue(property))
    }
  }

  const canvas = document.createElement('div')
  canvas.className = 'cm-mermaid-canvas cm-mermaid-fullscreen-canvas'
  canvas.tabIndex = 0
  overlay.append(canvas)

  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
  let handle: ReturnType<typeof mountMermaidCanvas> | null = null
  let closed = false
  const finish = (): void => {
    overlay.remove()
  }
  const close = (): void => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', handleKeyDown, true)
    handle?.destroy()
    handle = null
    previouslyFocused?.focus({ preventScroll: true })
    overlay.classList.remove('is-open')
    canvas.addEventListener('transitionend', finish, { once: true })
    window.setTimeout(finish, 240)
  }
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    close()
  }

  document.addEventListener('keydown', handleKeyDown, true)
  overlay.addEventListener('click', event => { if (event.target === overlay) close() })
  handle = mountMermaidCanvas(canvas, { svg: rendered.svg, ariaLabel, onClose: close })
  document.body.append(overlay)
  canvas.focus()
  void overlay.getBoundingClientRect()
  requestAnimationFrame(() => overlay.classList.add('is-open'))
}
