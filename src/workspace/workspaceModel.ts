import type { WorkspaceFileEntry } from '../core/contracts/workspace'

export type { WorkspaceFileEntry }

export function buildChildPath(parentPath: string, name: string): string {
  const separator = parentPath.includes('\\') && !parentPath.includes('/') ? '\\' : '/'
  return `${parentPath.replace(/[\\/]+$/, '')}${separator}${name}`
}

export function getParentPath(path: string): string | null {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index <= 0 ? null : path.slice(0, index)
}

export function getPathName(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index < 0 ? path : path.slice(index + 1)
}

export function pathMatches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}\\`)
}

export function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
  return path === oldPrefix ? newPrefix : pathMatches(path, oldPrefix) ? `${newPrefix}${path.slice(oldPrefix.length)}` : path
}

export function findEntry(entries: WorkspaceFileEntry[], path: string): WorkspaceFileEntry | null {
  for (const entry of entries) {
    if (entry.path === path) return entry
    if (entry.children) {
      const result = findEntry(entry.children, path)
      if (result) return result
    }
  }
  return null
}

export function filterEntries(entries: WorkspaceFileEntry[], query: string): WorkspaceFileEntry[] {
  const normalisedQuery = query.trim().toLocaleLowerCase()
  if (!normalisedQuery) return entries

  return entries.flatMap(entry => {
    const children = entry.children ? filterEntries(entry.children, normalisedQuery) : []
    const matches = entry.name.toLocaleLowerCase().includes(normalisedQuery)
    if (!matches && children.length === 0) return []
    return [{ ...entry, ...(entry.is_dir ? { children } : {}) }]
  })
}

export function sortEntries(entries: WorkspaceFileEntry[]): WorkspaceFileEntry[] {
  return [...entries].sort((a, b) => a.is_dir === b.is_dir ? a.name.toLowerCase().localeCompare(b.name.toLowerCase()) : a.is_dir ? -1 : 1)
}

export function replaceChildren(entries: WorkspaceFileEntry[], path: string, children: WorkspaceFileEntry[]): WorkspaceFileEntry[] {
  return entries.map(entry => entry.path === path
    ? { ...entry, children: sortEntries(children) }
    : entry.children ? { ...entry, children: replaceChildren(entry.children, path, children) } : entry)
}

export function rewriteEntryPaths(entry: WorkspaceFileEntry, oldPrefix: string, newPrefix: string): WorkspaceFileEntry {
  return {
    ...entry,
    path: replacePathPrefix(entry.path, oldPrefix, newPrefix),
    children: entry.children?.map(child => rewriteEntryPaths(child, oldPrefix, newPrefix)),
  }
}

export function renameEntry(entries: WorkspaceFileEntry[], oldPath: string, newPath: string, newName: string): WorkspaceFileEntry[] {
  return sortEntries(entries.map(entry => {
    if (entry.path !== oldPath) return entry.children ? { ...entry, children: renameEntry(entry.children, oldPath, newPath, newName) } : entry
    const renamed = { ...entry, name: newName, path: newPath, is_markdown: !entry.is_dir && newName.toLowerCase().endsWith('.md') }
    return entry.is_dir ? rewriteEntryPaths(renamed, oldPath, newPath) : renamed
  }))
}

export function deleteEntry(entries: WorkspaceFileEntry[], path: string): WorkspaceFileEntry[] {
  return entries.filter(entry => entry.path !== path).map(entry => entry.children ? { ...entry, children: deleteEntry(entry.children, path) } : entry)
}

function replaceCollection(entries: WorkspaceFileEntry[], path: string, update: (items: WorkspaceFileEntry[]) => WorkspaceFileEntry[]): WorkspaceFileEntry[] {
  return entries.map(entry => {
    if (entry.path === path && entry.is_dir) {
      return { ...entry, children: update(entry.children ?? []) }
    }
    return entry.children ? { ...entry, children: replaceCollection(entry.children, path, update) } : entry
  })
}

function removeEntry(entries: WorkspaceFileEntry[], path: string): { entries: WorkspaceFileEntry[]; entry: WorkspaceFileEntry | null } {
  const found = entries.find(entry => entry.path === path) ?? null
  if (found) return { entries: entries.filter(entry => entry.path !== path), entry: found }
  for (let index = 0; index < entries.length; index += 1) {
    const current = entries[index]
    if (!current.children) continue
    const result = removeEntry(current.children, path)
    if (result.entry) {
      const next = [...entries]
      next[index] = { ...current, children: result.entries }
      return { entries: next, entry: result.entry }
    }
  }
  return { entries, entry: null }
}

export function moveEntry(entries: WorkspaceFileEntry[], sourcePath: string, targetDir: string, newPath: string): WorkspaceFileEntry[] | null {
  const source = findEntry(entries, sourcePath)
  const target = findEntry(entries, targetDir)
  if (!source || (targetDir !== '' && (!target || !target.is_dir)) || sourcePath === targetDir || pathMatches(targetDir, sourcePath)) return null
  const sourceParent = getParentPath(sourcePath)
  if (sourceParent === targetDir) return null
  const removed = removeEntry(entries, sourcePath)
  if (!removed.entry) return null
  const moved = rewriteEntryPaths({ ...removed.entry, path: newPath, name: getPathName(newPath) }, sourcePath, newPath)
  const next = targetDir === getParentPath(sourcePath) || targetDir === ''
    ? sortEntries([...removed.entries, moved])
    : replaceCollection(removed.entries, targetDir, children => sortEntries([...children, moved]))
  return next
}

export function insertEntry(entries: WorkspaceFileEntry[], parentPath: string | null, entry: WorkspaceFileEntry): WorkspaceFileEntry[] {
  if (parentPath === null) return sortEntries([...entries, entry])
  return replaceCollection(entries, parentPath, children => sortEntries([...children, entry]))
}

export function rewritePath(path: string, oldPath: string, newPath: string): string {
  return replacePathPrefix(path, oldPath, newPath)
}

export function validateItemName(name: string): boolean {
  return Boolean(name.trim()) && !/[\\/]/.test(name) && name !== '.' && name !== '..'
}
