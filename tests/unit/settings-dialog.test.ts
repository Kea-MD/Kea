import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDefaultShortcutMap } from '../../src/modules/settings/shortcuts/shortcutRegistry'
import { useSettingsStore } from '../../src/modules/settings/state/settingsStore'
import SettingsDialog from '../../src/modules/settings/ui/SettingsDialog.vue'

const DialogStub = defineComponent({
  name: 'Dialog',
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:visible'],
  setup(_props, { slots }) {
    return () => h('div', { class: 'dialog-stub' }, slots.default?.())
  },
})

const SelectStub = defineComponent({
  name: 'Select',
  props: {
    modelValue: {
      type: String,
      default: null,
    },
    options: {
      type: Array,
      default: () => [],
    },
    optionLabel: {
      type: String,
      default: 'label',
    },
    optionValue: {
      type: String,
      default: 'value',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h(
      'select',
      {
        value: props.modelValue ?? undefined,
        onChange: (event: Event) => {
          const target = event.target as HTMLSelectElement
          emit('update:modelValue', target.value)
        },
      },
      (props.options as Array<Record<string, string>>).map(option =>
        h('option', { value: option[props.optionValue] }, option[props.optionLabel] ?? option[props.optionValue])
      )
    )
  },
})

const ToggleSwitchStub = defineComponent({
  name: 'ToggleSwitch',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', {
      type: 'checkbox',
      checked: props.modelValue,
      onChange: (event: Event) => {
        const target = event.target as HTMLInputElement
        emit('update:modelValue', target.checked)
      },
    })
  },
})

function mountDialog() {
  return mount(SettingsDialog, {
    props: {
      visible: true,
    },
    global: {
      stubs: {
        Dialog: DialogStub,
        Select: SelectStub,
        ToggleSwitch: ToggleSwitchStub,
      },
    },
  })
}

describe('SettingsDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('captures shortcut input, validates invalid combinations, and exits on Escape', async () => {
    const settingsStore = useSettingsStore()
    const wrapper = mountDialog()
    const firstShortcutChip = wrapper.findAll('button.shortcut-chip')[0]

    await firstShortcutChip.trigger('click')
    expect(settingsStore.isCapturingShortcut).toBe(true)

    await firstShortcutChip.trigger('keydown', { key: 'p' })
    expect(wrapper.text()).toContain('Shortcut must include Ctrl/Cmd or Alt and a non-modifier key.')
    expect(settingsStore.isCapturingShortcut).toBe(true)

    await firstShortcutChip.trigger('keydown', { key: 'Escape' })
    expect(settingsStore.isCapturingShortcut).toBe(false)
  })

  it('stores valid captured shortcut bindings', async () => {
    const settingsStore = useSettingsStore()
    const wrapper = mountDialog()
    const firstShortcutChip = wrapper.findAll('button.shortcut-chip')[0]

    await firstShortcutChip.trigger('click')
    await firstShortcutChip.trigger('keydown', { key: 'k', altKey: true })

    expect(settingsStore.shortcuts.new_file).toBe('Alt+K')
    expect(settingsStore.isCapturingShortcut).toBe(false)
  })

  it('supports reset-all and clear actions for shortcuts', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.setShortcut('quick_open', 'Alt+Q')

    const wrapper = mountDialog()

    await wrapper.get('button[title="Reset all shortcuts"]').trigger('click')
    expect(settingsStore.shortcuts).toEqual(getDefaultShortcutMap())

    await wrapper.findAll('button[title="Clear this shortcut"]')[0].trigger('click')
    expect(settingsStore.shortcuts.new_file).toBe('')
  })

  it('resets a single shortcut and persists appearance/workspace toggles', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.setShortcut('new_file', 'Alt+K')

    const wrapper = mountDialog()

    await wrapper.findAll('button[title="Reset this shortcut"]')[0].trigger('click')
    expect(settingsStore.shortcuts.new_file).toBe(getDefaultShortcutMap().new_file)

    const toggles = wrapper.findAll('input[type="checkbox"]')
    await toggles[0].setValue(false)
    await toggles[1].setValue(false)

    expect(settingsStore.edgeGlowEnabled).toBe(false)
    expect(settingsStore.restoreWorkspaceOnLaunch).toBe(false)
  })

  it('emits close and stops capture when dialog visibility is toggled off', async () => {
    const settingsStore = useSettingsStore()
    const wrapper = mountDialog()

    await wrapper.findAll('button.shortcut-chip')[0].trigger('click')
    expect(settingsStore.isCapturingShortcut).toBe(true)

    wrapper.getComponent(DialogStub).vm.$emit('update:visible', false)

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(settingsStore.isCapturingShortcut).toBe(false)
  })
})
