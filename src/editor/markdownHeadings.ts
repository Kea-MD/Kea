export interface MarkdownHeading {
  level: number
  text: string
  anchor: string
  position: number
}

export interface ActiveHeadingScrollState {
  scrollTop: number
  maxScrollTop: number
  activationOffset: number
  bottomSpread: number
  bottomTolerance: number
}

export function resolveActiveHeadingPosition(
  headings: readonly MarkdownHeading[],
  headingTops: readonly number[],
  state: ActiveHeadingScrollState,
): number | null {
  if (!headings.length) return null

  const maxScrollTop = Math.max(0, state.maxScrollTop)
  const activationPoints = headings.map((_, index) => Math.max(0, (headingTops[index] ?? 0) - state.activationOffset))
  if (maxScrollTop > 0 && state.bottomSpread > 0) {
    const bottomStart = Math.max(0, maxScrollTop - state.bottomSpread)
    const firstBottomHeading = activationPoints.findIndex(point => point >= bottomStart)
    if (firstBottomHeading >= 0) {
      const bottomHeadingCount = headings.length - firstBottomHeading
      for (let index = firstBottomHeading; index < headings.length; index += 1) {
        const step = index - firstBottomHeading + 1
        activationPoints[index] = bottomStart + (maxScrollTop - bottomStart) * (step / bottomHeadingCount)
      }
    }
  }

  let activePosition: number | null = null
  for (let index = 0; index < headings.length; index += 1) {
    const comparisonScrollTop = index === headings.length - 1
      ? Math.min(maxScrollTop, state.scrollTop + state.bottomTolerance)
      : state.scrollTop
    if (comparisonScrollTop < (activationPoints[index] ?? 0)) break
    activePosition = headings[index]?.position ?? activePosition
  }
  return activePosition
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
