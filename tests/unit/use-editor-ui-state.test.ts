import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { dispatchEditorUiState } from '../../src/modules/editor/editorCommands'
import { useEditorUiState } from '../../src/app/runtime/useEditorUiState'

const Harness = defineComponent({
  setup() {
    return useEditorUiState()
  },
  template: '<div />',
})

describe('useEditorUiState', () => {
  it('updates state from editor ui-state events', async () => {
    const wrapper = mount(Harness)

    dispatchEditorUiState({ findOpen: true, canUndo: true, canRedo: false })
    await nextTick()

    expect((wrapper.vm as unknown as { isFindOpen: boolean }).isFindOpen).toBe(true)
    expect((wrapper.vm as unknown as { canUndo: boolean }).canUndo).toBe(true)
    expect((wrapper.vm as unknown as { canRedo: boolean }).canRedo).toBe(false)
  })

  it('ignores undefined partial updates and removes listener on unmount', async () => {
    const wrapper = mount(Harness)
    const vm = wrapper.vm as unknown as {
      isFindOpen: boolean
      canUndo: boolean
      canRedo: boolean
    }

    dispatchEditorUiState({ findOpen: true, canUndo: true, canRedo: true })
    await nextTick()

    dispatchEditorUiState({ findOpen: false })
    await nextTick()

    expect(vm.isFindOpen).toBe(false)
    expect(vm.canUndo).toBe(true)
    expect(vm.canRedo).toBe(true)

    wrapper.unmount()

    dispatchEditorUiState({ findOpen: true, canUndo: false, canRedo: false })
    await nextTick()

    expect(vm.isFindOpen).toBe(false)
    expect(vm.canUndo).toBe(true)
    expect(vm.canRedo).toBe(true)
  })
})
