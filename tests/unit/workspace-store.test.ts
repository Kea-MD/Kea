import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { FileEntry } from '../../src/modules/workspace/state/workspaceStore'
import { useWorkspaceStore } from '../../src/modules/workspace/state/workspaceStore'

describe('workspaceStore helpers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('builds child paths using the parent separator style', () => {
    const workspaceStore = useWorkspaceStore()

    expect(workspaceStore.buildChildPath('/Users/alex/docs/', 'note.md')).toBe('/Users/alex/docs/note.md')
    expect(workspaceStore.buildChildPath('C:\\Users\\alex\\docs\\', 'note.md')).toBe('C:\\Users\\alex\\docs\\note.md')
  })

  it('sorts directories before files and alphabetically', () => {
    const workspaceStore = useWorkspaceStore()
    const entries: FileEntry[] = [
      { name: 'z.md', path: '/z.md', is_dir: false, is_markdown: true },
      { name: 'b-folder', path: '/b-folder', is_dir: true, is_markdown: false, children: [] },
      { name: 'a-folder', path: '/a-folder', is_dir: true, is_markdown: false, children: [] },
      { name: 'a.md', path: '/a.md', is_dir: false, is_markdown: true },
    ]

    workspaceStore.sortEntries(entries)

    expect(entries.map(entry => entry.name)).toEqual(['a-folder', 'b-folder', 'a.md', 'z.md'])
  })

  it('removes nested entries from the tree', () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.entries = [
      {
        name: 'docs',
        path: '/docs',
        is_dir: true,
        is_markdown: false,
        children: [
          {
            name: 'draft.md',
            path: '/docs/draft.md',
            is_dir: false,
            is_markdown: true,
          },
        ],
      },
    ]

    const removed = workspaceStore.removeEntry('/docs/draft.md')

    expect(removed).toBe(true)
    expect(workspaceStore.findEntry('/docs/draft.md')).toBeNull()
  })

  it('updates path prefixes and path matching correctly', () => {
    const workspaceStore = useWorkspaceStore()

    expect(workspaceStore.pathMatches('/docs/folder/file.md', '/docs/folder')).toBe(true)
    expect(workspaceStore.pathMatches('/docs/file.md', '/docs/folder')).toBe(false)
    expect(workspaceStore.replacePathPrefix('/docs/folder/file.md', '/docs/folder', '/archive/folder')).toBe('/archive/folder/file.md')
  })
})
