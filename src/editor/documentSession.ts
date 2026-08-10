export const DOCUMENT_SESSIONS_STORAGE_KEY = 'kea-open-document-sessions'

export interface DocumentSession {
  paths: string[]
  activePath: string | null
}

type StoredDocumentSessions = Record<string, DocumentSession>

function readSessions(): StoredDocumentSessions {
  try {
    const raw = window.localStorage.getItem(DOCUMENT_SESSIONS_STORAGE_KEY)
    if (!raw) return {}
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value as StoredDocumentSessions
  } catch {
    return {}
  }
}

function normaliseSession(value: unknown): DocumentSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as { paths?: unknown; activePath?: unknown }
  if (!Array.isArray(candidate.paths)) return null
  const paths = Array.from(new Set(candidate.paths.filter((path): path is string => typeof path === 'string' && path.length > 0)))
  const activePath = typeof candidate.activePath === 'string' && paths.includes(candidate.activePath) ? candidate.activePath : null
  return { paths, activePath }
}

function sessionKey(windowLabel: string, workspacePath: string): string {
  return `${windowLabel}:${workspacePath}`
}

export function readDocumentSession(windowLabel: string, workspacePath: string): DocumentSession | null {
  return normaliseSession(readSessions()[sessionKey(windowLabel, workspacePath)])
}

export function writeDocumentSession(windowLabel: string, workspacePath: string, session: DocumentSession): void {
  try {
    const sessions = readSessions()
    sessions[sessionKey(windowLabel, workspacePath)] = {
      paths: Array.from(new Set(session.paths.filter(path => path.length > 0))),
      activePath: session.activePath && session.paths.includes(session.activePath) ? session.activePath : null,
    }
    window.localStorage.setItem(DOCUMENT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // Session persistence is best effort and must not interrupt editing.
  }
}

export function clearDocumentSession(windowLabel: string, workspacePath: string): void {
  try {
    const sessions = readSessions()
    delete sessions[sessionKey(windowLabel, workspacePath)]
    if (Object.keys(sessions).length === 0) window.localStorage.removeItem(DOCUMENT_SESSIONS_STORAGE_KEY)
    else window.localStorage.setItem(DOCUMENT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // Session persistence is best effort and must not interrupt editing.
  }
}
