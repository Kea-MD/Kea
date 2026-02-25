import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import type { FileEntry } from '../../src/modules/workspace/state/workspaceStore'
import { useDocumentStore } from '../../src/modules/editor/state/documentStore'
import FileTreeItem from '../../src/modules/workspace/ui/FileTreeItem.vue'
import { useWorkspaceStore } from '../../src/modules/workspace/state/workspaceStore'

function makeEntry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    name: 'note.md',
    path: '/workspace/note.md',
    is_dir: false,
    is_markdown: true,
    ...overrides,
  }
}

describe('FileTreeItem', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits click, toggle and pointer drag events from keyboard/mouse interactions', async () => {
    const entry = makeEntry({ is_dir: true, is_markdown: false, path: '/workspace/docs', name: 'docs' })

    const collapsedWrapper = mount(FileTreeItem, {
      props: {
        entry,
        level: 0,
        isExpanded: false,
        activePath: null,
      },
    })

    await collapsedWrapper.get('.tree-item').trigger('keydown', { key: 'Enter' })
    await collapsedWrapper.get('.tree-item').trigger('keydown', { key: 'ArrowRight' })
    await collapsedWrapper.get('.tree-item').trigger('mousedown', { button: 0 })

    expect(collapsedWrapper.emitted('click')).toHaveLength(1)
    expect(collapsedWrapper.emitted('toggle')).toContainEqual([entry.path])
    expect(collapsedWrapper.emitted('pointer-drag-start')).toHaveLength(1)

    const expandedWrapper = mount(FileTreeItem, {
      props: {
        entry,
        level: 0,
        isExpanded: true,
        activePath: null,
      },
    })

    await expandedWrapper.get('.tree-item').trigger('keydown', { key: 'ArrowLeft' })
    expect(expandedWrapper.emitted('toggle')).toContainEqual([entry.path])
  })

  it('renames item and updates document paths when rename completes', async () => {
    const workspaceStore = useWorkspaceStore()
    const documentStore = useDocumentStore()
    const entry = makeEntry()

    const renameItemSpy = vi.spyOn(workspaceStore, 'renameItem').mockResolvedValue('/workspace/renamed.md')
    const updatePathsSpy = vi.spyOn(documentStore, 'updatePathsAfterRename')

    const wrapper = mount(FileTreeItem, {
      props: {
        entry,
        level: 0,
        isExpanded: false,
        activePath: null,
        renamePath: entry.path,
      },
    })

    await flushPromises()

    const input = wrapper.get('input.rename-input')
    await input.setValue('renamed.md')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(renameItemSpy).toHaveBeenCalledWith('/workspace/note.md', 'renamed.md')
    expect(updatePathsSpy).toHaveBeenCalledWith('/workspace/note.md', '/workspace/renamed.md', false)
  })

  it('rejects invalid rename values without calling store rename', async () => {
    const workspaceStore = useWorkspaceStore()
    const entry = makeEntry()

    const renameItemSpy = vi.spyOn(workspaceStore, 'renameItem').mockResolvedValue('/workspace/unused.md')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(FileTreeItem, {
      props: {
        entry,
        level: 0,
        isExpanded: false,
        activePath: null,
        renamePath: entry.path,
      },
    })

    await flushPromises()

    const input = wrapper.get('input.rename-input')
    await input.setValue('bad/name.md')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(renameItemSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('applies active/drag/drop classes and starts rename on double click for files', async () => {
    const entry = makeEntry()
    const wrapper = mount(FileTreeItem, {
      props: {
        entry,
        level: 1,
        isExpanded: false,
        activePath: entry.path,
        draggingPath: entry.path,
        dropTargetPath: entry.path,
      },
    })

    const treeItem = wrapper.get('.tree-item')
    expect(treeItem.classes()).toEqual(expect.arrayContaining(['is-active', 'is-dragging', 'is-drop-target']))

    await treeItem.trigger('dblclick')
    await flushPromises()

    expect(wrapper.find('input.rename-input').exists()).toBe(true)
  })

  it('forwards child events from nested entries to parent emits', async () => {
    const NestedStub = defineComponent({
      name: 'NestedStub',
      emits: ['click', 'toggle', 'context-menu', 'pointer-drag-start'],
      template: '<li class="nested-stub"></li>',
    })

    const childEntry = makeEntry({ name: 'child.md', path: '/workspace/docs/child.md' })
    const parentEntry = makeEntry({
      name: 'docs',
      path: '/workspace/docs',
      is_dir: true,
      is_markdown: false,
      children: [childEntry],
    })

    const wrapper = mount(FileTreeItem, {
      props: {
        entry: parentEntry,
        level: 0,
        isExpanded: true,
        activePath: null,
      },
      global: {
        stubs: {
          FileTreeItem: NestedStub,
        },
      },
    })

    const nestedChild = wrapper.getComponent(NestedStub)

    nestedChild.vm.$emit('click', childEntry)
    nestedChild.vm.$emit('toggle', childEntry.path)
    nestedChild.vm.$emit('context-menu', new MouseEvent('contextmenu'), childEntry)
    nestedChild.vm.$emit('pointer-drag-start', new MouseEvent('mousedown'), childEntry)

    expect(wrapper.emitted('click')).toContainEqual([childEntry])
    expect(wrapper.emitted('toggle')).toContainEqual([childEntry.path])
    expect(wrapper.emitted('context-menu')?.[0]?.[1]).toEqual(childEntry)
    expect(wrapper.emitted('pointer-drag-start')?.[0]?.[1]).toEqual(childEntry)
  })

  it('logs rename errors and cancels rename on escape key', async () => {
    const workspaceStore = useWorkspaceStore()
    const entry = makeEntry()
    vi.spyOn(workspaceStore, 'renameItem').mockRejectedValue(new Error('rename failed'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(FileTreeItem, {
      props: {
        entry,
        level: 0,
        isExpanded: false,
        activePath: null,
        renamePath: entry.path,
      },
    })

    await flushPromises()
    const input = wrapper.get('input.rename-input')
    await input.setValue('renamed.md')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to rename:', expect.any(Error))
    expect(wrapper.find('input.rename-input').exists()).toBe(false)

    await wrapper.get('.tree-item').trigger('dblclick')
    await flushPromises()
    const escapeInput = wrapper.get('input.rename-input')
    await escapeInput.trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(wrapper.find('input.rename-input').exists()).toBe(false)
  })

  it('starts rename via F2 and cancels when name is unchanged', async () => {
    const entry = makeEntry({ name: 'same-name.md' })
    const workspaceStore = useWorkspaceStore()
    const renameItemSpy = vi.spyOn(workspaceStore, 'renameItem').mockResolvedValue('/workspace/same-name.md')

    const wrapper = mount(FileTreeItem, {
      props: {
        entry,
        level: 0,
        isExpanded: false,
        activePath: null,
      },
    })

    await wrapper.get('.tree-item').trigger('keydown', { key: 'F2' })
    await flushPromises()

    const input = wrapper.get('input.rename-input')
    await input.setValue('same-name.md')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(renameItemSpy).not.toHaveBeenCalled()
    expect(wrapper.find('input.rename-input').exists()).toBe(false)
  })

  it('uses generic file icon and blocks click/drag while renaming', async () => {
    const entry = makeEntry({ is_markdown: false, name: 'binary.bin', path: '/workspace/binary.bin' })
    const wrapper = mount(FileTreeItem, {
      props: {
        entry,
        level: 0,
        isExpanded: false,
        activePath: null,
      },
    })

    expect(wrapper.get('.item-icon').classes()).toContain('pi-file')

    await wrapper.get('.tree-item').trigger('dblclick')
    await flushPromises()

    await wrapper.get('.tree-item').trigger('click')
    await wrapper.get('input.rename-input').trigger('mousedown', {
      button: 0,
    })

    expect(wrapper.emitted('click')).toBeUndefined()
    expect(wrapper.emitted('pointer-drag-start')).toBeUndefined()
  })
})
