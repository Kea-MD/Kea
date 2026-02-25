import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EditorToolbar from '../../src/modules/editor/ui/EditorToolbar.vue'
import { primeVueStubs } from '../helpers/primeVueStubs'

describe('EditorToolbar', () => {
  it('emits sidebar and command events from toolbar buttons', async () => {
    const wrapper = mount(EditorToolbar, {
      props: {
        sidebarOpen: true,
        hasOpenFile: true,
        canUndo: true,
        canRedo: true,
        findOpen: false,
        editorMode: 'rendered',
      },
      global: {
        stubs: primeVueStubs,
      },
    })

    const sidebarButton = wrapper.get('button[title="Hide Sidebar"]')
    await sidebarButton.trigger('mouseenter')
    await sidebarButton.trigger('mouseleave')
    await sidebarButton.trigger('click')

    await wrapper.get('button[title="Undo"]').trigger('click')
    await wrapper.get('button[title="Source View"]').trigger('click')

    expect(wrapper.emitted('hover-sidebar')).toEqual([[true], [false]])
    expect(wrapper.emitted('toggle-sidebar')).toHaveLength(1)
    expect(wrapper.emitted('command')).toContainEqual(['undo'])
    expect(wrapper.emitted('set-editor-mode')).toContainEqual(['source'])
  })

  it('updates the find button title based on open state', () => {
    const closedFindWrapper = mount(EditorToolbar, {
      props: {
        hasOpenFile: true,
        findOpen: false,
      },
      global: {
        stubs: primeVueStubs,
      },
    })

    expect(closedFindWrapper.find('button[title="Find"]').exists()).toBe(true)

    const openFindWrapper = mount(EditorToolbar, {
      props: {
        hasOpenFile: true,
        findOpen: true,
      },
      global: {
        stubs: primeVueStubs,
      },
    })

    expect(openFindWrapper.find('button[title="Close Find"]').exists()).toBe(true)
  })

  it('emits command events for formatting, insert and select actions', async () => {
    const wrapper = mount(EditorToolbar, {
      props: {
        hasOpenFile: true,
        canUndo: true,
        canRedo: true,
      },
      global: {
        stubs: primeVueStubs,
      },
    })

    const buttonTitles = [
      'Redo',
      'Bold',
      'Italic',
      'Strikethrough',
      'Inline Code',
      'Code Block',
      'Blockquote',
      'Horizontal Rule',
      'Insert Link',
      'Insert Image',
      'Highlight',
      'Find',
    ]

    for (const title of buttonTitles) {
      await wrapper.get(`button[title="${title}"]`).trigger('click')
    }

    const selects = wrapper.findAll('select')
    await selects[0].setValue('heading-2')
    await selects[1].setValue('task-list')

    const emittedCommands = (wrapper.emitted('command') ?? []).map(event => event[0])
    expect(emittedCommands).toEqual(expect.arrayContaining([
      'redo',
      'bold',
      'italic',
      'strikethrough',
      'code',
      'code-block',
      'blockquote',
      'insert-hr',
      'insert-link',
      'insert-image',
      'insert-highlight',
      'find',
      'heading-2',
      'task-list',
    ]))
  })
})
