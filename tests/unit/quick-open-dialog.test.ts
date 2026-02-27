import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileEntry } from '../../src/modules/workspace/state/workspaceStore'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'
import { useWorkspaceStore } from '../../src/modules/workspace/state/workspaceStore'
import QuickOpenDialog from '../../src/modules/workspace/ui/QuickOpenDialog.vue'

function makeFile(path: string, name: string): FileEntry {
  return {
    path,
    name,
    is_dir: false,
    is_markdown: true,
  }
}

function makeDir(path: string, name: string, children: FileEntry[] = []): FileEntry {
  return {
    path,
    name,
    is_dir: true,
    is_markdown: false,
    children,
  }
}

describe('QuickOpenDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('shows recent files first and caps results to twenty', () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()

    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = Array.from({ length: 25 }, (_, index) =>
      makeFile(`/workspace/file-${index}.md`, `file-${index}.md`)
    )

    documentStore.recentFiles = [
      { path: '/workspace/file-7.md', name: 'file-7.md', lastOpened: 2 },
      { path: '/workspace/file-5.md', name: 'file-5.md', lastOpened: 1 },
    ]

    const wrapper = mount(QuickOpenDialog)
    const resultRows = wrapper.findAll('.result-item')
    expect(resultRows).toHaveLength(20)

    const firstTwoNames = wrapper
      .findAll('.result-item .result-name')
      .slice(0, 2)
      .map(node => node.text())

    expect(firstTwoNames).toEqual(expect.arrayContaining(['file-5.md', 'file-7.md']))
  })

  it('collects markdown files recursively from nested folders', () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeDir('/workspace/docs', 'docs', [
        makeFile('/workspace/docs/child.md', 'child.md'),
      ]),
    ]

    const wrapper = mount(QuickOpenDialog)
    const names = wrapper.findAll('.result-item .result-name').map(node => node.text())

    expect(names).toContain('child.md')
  })

  it('supports keyboard navigation and opens selected file on Enter', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()

    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeFile('/workspace/one.md', 'one.md'),
      makeFile('/workspace/two.md', 'two.md'),
      makeFile('/workspace/three.md', 'three.md'),
    ]

    const openFileSpy = vi.spyOn(documentStore, 'openFileFromPath').mockResolvedValue('doc-3')

    const wrapper = mount(QuickOpenDialog)
    const input = wrapper.get('input.search-input')

    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })

    expect(openFileSpy).toHaveBeenCalledWith('/workspace/three.md')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('filters results using fuzzy matching and shows no-results state', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeFile('/workspace/readme.md', 'readme.md'),
      makeFile('/workspace/roadmap.md', 'roadmap.md'),
      makeFile('/workspace/chores.md', 'chores.md'),
    ]

    const wrapper = mount(QuickOpenDialog)
    const input = wrapper.get('input.search-input')

    await input.setValue('re')

    const names = wrapper.findAll('.result-item .result-name').map(node => node.text())
    expect(names[0]).toBe('readme.md')

    await input.setValue('zzzz')
    expect(wrapper.find('.no-results').text()).toContain('No matching files found')
  })

  it('opens file on row click and shows full path when root path is missing', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()
    workspaceStore.rootPath = null
    workspaceStore.entries = [
      makeFile('/workspace/docs/readme.md', 'readme.md'),
    ]

    const openFileSpy = vi.spyOn(documentStore, 'openFileFromPath').mockResolvedValue('doc-readme')

    const wrapper = mount(QuickOpenDialog)
    expect(wrapper.find('.result-path').text()).toBe('/workspace/docs/readme.md')

    await wrapper.get('.result-item').trigger('click')

    expect(openFileSpy).toHaveBeenCalledWith('/workspace/docs/readme.md')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('closes on Escape and overlay click', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [makeFile('/workspace/one.md', 'one.md')]

    const wrapper = mount(QuickOpenDialog)
    const input = wrapper.get('input.search-input')

    await input.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.get('.quick-switcher-overlay').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('keeps selection within bounds and does not close for inner-panel clicks', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeFile('/workspace/one.md', 'one.md'),
      makeFile('/workspace/two.md', 'two.md'),
    ]

    const wrapper = mount(QuickOpenDialog)
    const input = wrapper.get('input.search-input')

    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })

    const selectedRows = wrapper.findAll('.result-item.is-selected')
    expect(selectedRows).toHaveLength(1)
    expect(selectedRows[0].find('.result-name').text()).toBe('two.md')

    await wrapper.get('.quick-switcher').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('updates selection on hover and opens hovered file with Enter', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeFile('/workspace/one.md', 'one.md'),
      makeFile('/workspace/two.md', 'two.md'),
    ]

    const openFileSpy = vi.spyOn(documentStore, 'openFileFromPath').mockResolvedValue('doc-two')
    const wrapper = mount(QuickOpenDialog)

    await wrapper.findAll('.result-item')[1].trigger('mouseenter')
    await wrapper.get('input.search-input').trigger('keydown', { key: 'Enter' })

    expect(openFileSpy).toHaveBeenCalledWith('/workspace/two.md')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('applies fuzzy-score search when query is non-contiguous', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.rootPath = '/workspace'
    workspaceStore.entries = [
      makeFile('/workspace/readme.md', 'readme.md'),
      makeFile('/workspace/radial.md', 'radial.md'),
      makeFile('/workspace/roadmap.md', 'roadmap.md'),
    ]

    const wrapper = mount(QuickOpenDialog)
    const input = wrapper.get('input.search-input')

    await input.setValue('rdm')

    const names = wrapper.findAll('.result-item .result-name').map(node => node.text())
    expect(names).toEqual(expect.arrayContaining(['readme.md', 'roadmap.md']))
  })
})
