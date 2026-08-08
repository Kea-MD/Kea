import { describe, expect, it } from 'vitest'
import {
  findEntry,
  moveEntry,
  renameEntry,
  type WorkspaceFileEntry,
} from '../../src/workspace/workspaceModel'

const nested: WorkspaceFileEntry[] = [{
  name: 'docs', path: 'C:\\docs', is_dir: true, is_markdown: false, children: [{
    name: 'drafts', path: 'C:\\docs\\drafts', is_dir: true, is_markdown: false, children: [{
      name: 'note.md', path: 'C:\\docs\\drafts\\note.md', is_dir: false, is_markdown: true,
    }],
  }],
}]

describe('React workspace model', () => {
  it('finds entries recursively and rewrites nested Windows paths on rename', () => {
    expect(findEntry(nested, 'C:\\docs\\drafts\\note.md')?.name).toBe('note.md')
    const renamed = renameEntry(nested, 'C:\\docs', 'C:\\archive', 'archive')
    expect(findEntry(renamed, 'C:\\archive\\drafts\\note.md')?.name).toBe('note.md')
  })

  it('moves nested directories and their descendants without losing children', () => {
    const entries: WorkspaceFileEntry[] = [...nested, {
      name: 'archive', path: 'C:\\archive', is_dir: true, is_markdown: false, children: [],
    }]
    const moved = moveEntry(entries, 'C:\\docs\\drafts', 'C:\\archive', 'C:\\archive\\drafts')
    expect(moved && findEntry(moved, 'C:\\archive\\drafts\\note.md')?.name).toBe('note.md')
    expect(moved && findEntry(moved, 'C:\\docs\\drafts')).toBeNull()
  })
})
