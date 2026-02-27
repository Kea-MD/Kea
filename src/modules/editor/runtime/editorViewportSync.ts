import type { EditorMode } from '../editorCommands'

interface SharedAnchor {
  mode: EditorMode
  token: string
  tokenRelativeOffset: number
  cursorRatio: number
  scrollRatio: number
  updatedAt: number
}

interface SourceSnapshot {
  cursorOffset: number
  scrollRatio: number
  markdownText: string
  updatedAt: number
}

interface RenderedSnapshot {
  pmPos: number
  plainCursorOffset: number
  scrollRatio: number
  plainText: string
  updatedAt: number
}

interface DocumentViewportSnapshot {
  source?: SourceSnapshot
  rendered?: RenderedSnapshot
  anchor?: SharedAnchor
}

interface SourceRestore {
  cursorOffset: number
  scrollRatio: number
}

interface RenderedRestore {
  pmPos?: number
  plainCursorOffset: number
  scrollRatio: number
}

const viewportSnapshots = new Map<string, DocumentViewportSnapshot>()

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0
  return clamp(value, 0, 1)
}

function getSafeCursorOffset(text: string, offset: number): number {
  return clamp(Math.round(offset), 0, text.length)
}

function extractAnchorToken(text: string, offset: number): { token: string, tokenStart: number } {
  if (text.length === 0) return { token: '', tokenStart: -1 }

  const center = clamp(Math.round(offset), 0, text.length - 1)
  const start = Math.max(0, center - 64)
  const end = Math.min(text.length, center + 64)
  const windowText = text.slice(start, end)

  let bestToken = ''
  let bestTokenStart = -1
  let bestDistance = Number.POSITIVE_INFINITY

  const tokenRegex = /[A-Za-z0-9][A-Za-z0-9_-]{1,}/g
  for (const match of windowText.matchAll(tokenRegex)) {
    const token = match[0]
    const tokenStart = start + (match.index ?? 0)
    const distance = Math.abs(tokenStart - center)
    if (distance < bestDistance) {
      bestDistance = distance
      bestToken = token
      bestTokenStart = tokenStart
    }
  }

  return {
    token: bestToken,
    tokenStart: bestTokenStart,
  }
}

function findClosestOccurrence(text: string, token: string, expectedOffset: number): number {
  if (token.length < 2) return -1

  const lowerText = text.toLowerCase()
  const lowerToken = token.toLowerCase()

  let index = lowerText.indexOf(lowerToken)
  if (index === -1) return -1

  let bestIndex = index
  let bestDistance = Math.abs(index - expectedOffset)

  while (index !== -1) {
    const distance = Math.abs(index - expectedOffset)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
    index = lowerText.indexOf(lowerToken, index + 1)
  }

  return bestIndex
}

function buildAnchor(mode: EditorMode, text: string, cursorOffset: number, scrollRatio: number): SharedAnchor {
  const safeCursorOffset = getSafeCursorOffset(text, cursorOffset)
  const tokenOffset = text.length > 0 ? Math.min(safeCursorOffset, text.length - 1) : 0
  const { token, tokenStart } = extractAnchorToken(text, tokenOffset)

  const tokenRelativeOffset = tokenStart === -1
    ? 0
    : clamp(safeCursorOffset - tokenStart, 0, token.length)

  return {
    mode,
    token,
    tokenRelativeOffset,
    cursorRatio: text.length > 0 ? safeCursorOffset / text.length : 0,
    scrollRatio: clampRatio(scrollRatio),
    updatedAt: Date.now(),
  }
}

function resolveOffsetFromAnchor(text: string, anchor: SharedAnchor): number {
  if (text.length === 0) return 0

  const expectedOffset = clamp(Math.round(anchor.cursorRatio * text.length), 0, text.length)
  const matchedOffset = findClosestOccurrence(text, anchor.token, expectedOffset)

  if (matchedOffset !== -1) {
    const matchedTokenOffset = clamp(
      matchedOffset + (anchor.tokenRelativeOffset ?? 0),
      0,
      text.length,
    )

    return matchedTokenOffset
  }

  return expectedOffset
}

function createPlainToMarkdownBoundaryMap(markdown: string, plain: string): number[] {
  const boundaries = new Array<number>(plain.length + 1)
  boundaries[0] = 0

  let markdownIndex = 0

  for (let plainIndex = 0; plainIndex < plain.length; plainIndex += 1) {
    const char = plain[plainIndex]

    const next = markdown.indexOf(char, markdownIndex)
    if (next === -1) {
      boundaries[plainIndex + 1] = markdownIndex
      continue
    }

    markdownIndex = next + 1
    boundaries[plainIndex + 1] = markdownIndex
  }

  return boundaries
}

function mapPlainOffsetToMarkdownOffset(markdown: string, plain: string, plainOffset: number): number {
  const boundaries = createPlainToMarkdownBoundaryMap(markdown, plain)
  const safeOffset = clamp(Math.round(plainOffset), 0, plain.length)
  return clamp(boundaries[safeOffset] ?? 0, 0, markdown.length)
}

function mapMarkdownOffsetToPlainOffset(markdown: string, plain: string, markdownOffset: number): number {
  const boundaries = createPlainToMarkdownBoundaryMap(markdown, plain)
  const safeMarkdownOffset = clamp(Math.round(markdownOffset), 0, markdown.length)

  let low = 0
  let high = boundaries.length - 1

  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (boundaries[mid] <= safeMarkdownOffset) {
      low = mid
    } else {
      high = mid - 1
    }
  }

  return clamp(low, 0, plain.length)
}

function getOrCreateSnapshot(documentId: string): DocumentViewportSnapshot {
  const existing = viewportSnapshots.get(documentId)
  if (existing) return existing

  const created: DocumentViewportSnapshot = {}
  viewportSnapshots.set(documentId, created)
  return created
}

export function recordSourceViewportSnapshot(input: {
  documentId: string
  markdown: string
  cursorOffset: number
  scrollRatio: number
}): void {
  const snapshot = getOrCreateSnapshot(input.documentId)
  const now = Date.now()

  snapshot.source = {
    cursorOffset: Math.max(0, Math.round(input.cursorOffset)),
    scrollRatio: clampRatio(input.scrollRatio),
    markdownText: input.markdown,
    updatedAt: now,
  }

  snapshot.anchor = buildAnchor('source', input.markdown, input.cursorOffset, input.scrollRatio)
}

export function recordRenderedViewportSnapshot(input: {
  documentId: string
  plainText: string
  plainCursorOffset: number
  pmPos: number
  scrollRatio: number
}): void {
  const snapshot = getOrCreateSnapshot(input.documentId)
  const now = Date.now()

  snapshot.rendered = {
    pmPos: Math.max(0, Math.round(input.pmPos)),
    plainCursorOffset: Math.max(0, Math.round(input.plainCursorOffset)),
    scrollRatio: clampRatio(input.scrollRatio),
    plainText: input.plainText,
    updatedAt: now,
  }

  snapshot.anchor = buildAnchor('rendered', input.plainText, input.plainCursorOffset, input.scrollRatio)
}

export function getSourceViewportRestore(documentId: string, markdown: string): SourceRestore | null {
  const snapshot = viewportSnapshots.get(documentId)
  if (!snapshot) return null

  const source = snapshot.source
  const rendered = snapshot.rendered

  if (rendered && (!source || rendered.updatedAt >= source.updatedAt)) {
    const cursorOffset = mapPlainOffsetToMarkdownOffset(
      markdown,
      rendered.plainText,
      rendered.plainCursorOffset,
    )

    const restore = {
      cursorOffset,
      scrollRatio: rendered.scrollRatio,
    }

    console.debug('[viewport-sync][coordinator] source restore', {
      documentId,
      strategy: 'rendered-map',
      cursorOffset: restore.cursorOffset,
      scrollRatio: restore.scrollRatio,
    })

    return restore
  }

  if (source) {
    const maxOffset = markdown.length
    const restore = {
      cursorOffset: clamp(source.cursorOffset, 0, maxOffset),
      scrollRatio: source.scrollRatio,
    }

    console.debug('[viewport-sync][coordinator] source restore', {
      documentId,
      strategy: 'source-snapshot',
      cursorOffset: restore.cursorOffset,
      scrollRatio: restore.scrollRatio,
    })

    return restore
  }

  const anchor = snapshot.anchor
  if (anchor) {
    const restore = {
      cursorOffset: resolveOffsetFromAnchor(markdown, anchor),
      scrollRatio: anchor.scrollRatio,
    }

    console.debug('[viewport-sync][coordinator] source restore', {
      documentId,
      strategy: 'fallback-anchor',
      cursorOffset: restore.cursorOffset,
      scrollRatio: restore.scrollRatio,
      anchorToken: anchor.token,
    })

    return restore
  }

  return null
}

export function getRenderedViewportRestore(documentId: string, plainText: string): RenderedRestore | null {
  const snapshot = viewportSnapshots.get(documentId)
  if (!snapshot) return null

  const source = snapshot.source
  const rendered = snapshot.rendered

  if (source && (!rendered || source.updatedAt >= rendered.updatedAt)) {
    const plainCursorOffset = mapMarkdownOffsetToPlainOffset(
      source.markdownText,
      plainText,
      source.cursorOffset,
    )

    const restore = {
      plainCursorOffset,
      scrollRatio: source.scrollRatio,
    }

    console.debug('[viewport-sync][coordinator] rendered restore', {
      documentId,
      strategy: 'source-map',
      plainCursorOffset: restore.plainCursorOffset,
      scrollRatio: restore.scrollRatio,
    })

    return restore
  }

  if (rendered) {
    const maxOffset = plainText.length
    const restore = {
      pmPos: rendered.pmPos,
      plainCursorOffset: clamp(rendered.plainCursorOffset, 0, maxOffset),
      scrollRatio: rendered.scrollRatio,
    }

    console.debug('[viewport-sync][coordinator] rendered restore', {
      documentId,
      strategy: 'rendered-snapshot',
      pmPos: restore.pmPos,
      plainCursorOffset: restore.plainCursorOffset,
      scrollRatio: restore.scrollRatio,
    })

    return restore
  }

  const anchor = snapshot.anchor
  if (anchor) {
    const restore = {
      plainCursorOffset: resolveOffsetFromAnchor(plainText, anchor),
      scrollRatio: anchor.scrollRatio,
    }

    console.debug('[viewport-sync][coordinator] rendered restore', {
      documentId,
      strategy: 'fallback-anchor',
      plainCursorOffset: restore.plainCursorOffset,
      scrollRatio: restore.scrollRatio,
      anchorToken: anchor.token,
    })

    return restore
  }

  return null
}

export function clearDocumentViewportSnapshot(documentId: string): void {
  viewportSnapshots.delete(documentId)
}
