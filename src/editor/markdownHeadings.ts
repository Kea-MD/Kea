export interface MarkdownHeading {
  level: number
  text: string
  anchor: string
  position: number
}

export function markdownSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~[\]()]|&[a-z]+;/gi, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  const counts = new Map<string, number>()
  const lines = markdown.split('\n')
  let position = 0
  let fence: string | null = null

  const add = (level: number, text: string, at: number): void => {
    const clean = text.replace(/\s+#+\s*$/, '').trim()
    const base = markdownSlug(clean)
    if (!base) return
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    headings.push({ level, text: clean, anchor: count ? `${base}-${count}` : base, position: at })
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1]?.[0] ?? '`'
      if (!fence) fence = marker
      else if (fence === marker) fence = null
      position += line.length + 1
      continue
    }
    if (!fence) {
      const atx = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/)
      if (atx) add(atx[1]?.length ?? 1, atx[2] ?? '', position)
      else if (index + 1 < lines.length && line.trim()) {
        const underline = lines[index + 1]?.match(/^\s{0,3}(=+|-+)\s*$/)
        if (underline) add(underline[1]?.startsWith('=') ? 1 : 2, line, position)
      }
    }
    position += line.length + 1
  }
  return headings
}
