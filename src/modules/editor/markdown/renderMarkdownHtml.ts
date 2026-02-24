import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify'
import { Marked } from 'marked'

const sanitizeConfig: DomPurifyConfig = {
  ADD_TAGS: ['details', 'summary', 'kbd', 'sub', 'sup', 'input'],
  ADD_ATTR: ['class', 'id', 'width', 'height', 'open', 'type', 'checked', 'disabled'],
}

const markdownRenderer = new Marked({
  gfm: true,
  breaks: false,
})

function escapeHtml(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderMarkdownHtml(source: string): string {
  try {
    const html = markdownRenderer.parse(source, { async: false }).trim()
    const sanitized = DOMPurify.sanitize(html, sanitizeConfig)

    return sanitized.length > 0
      ? sanitized
      : `<p>${escapeHtml(source)}</p>`
  } catch (error) {
    console.error('Failed to render markdown block:', error)
    return `<pre><code>${escapeHtml(source)}</code></pre>`
  }
}
