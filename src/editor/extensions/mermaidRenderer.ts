import { renderMermaidSVG } from 'beautiful-mermaid'
import DOMPurify from 'dompurify'

export interface MermaidRenderResult {
  svg?: string
  error?: string
}

const CACHE_LIMIT = 50
const cache = new Map<string, string>()

function readCache(source: string): string | undefined {
  const svg = cache.get(source)
  if (svg === undefined) return undefined
  cache.delete(source)
  cache.set(source, svg)
  return svg
}

function writeCache(source: string, svg: string): void {
  cache.delete(source)
  cache.set(source, svg)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export function sanitiseMermaidSvg(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })
}

export function renderMermaid(source: string): MermaidRenderResult {
  const cached = readCache(source)
  if (cached !== undefined) return { svg: cached }

  try {
    const svg = sanitiseMermaidSvg(renderMermaidSVG(source, {
      bg: 'var(--bg-base)',
      fg: 'var(--fg-base)',
      transparent: true,
    }))
    writeCache(source, svg)
    return { svg }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export function clearMermaidCache(): void {
  cache.clear()
}
