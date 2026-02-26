import { defineComponent, h } from 'vue'

function isDisabledAttribute(value: unknown): boolean {
  return value === '' || value === true || value === 'true'
}

const ToolbarStub = defineComponent({
  name: 'ToolbarStub',
  setup(_, { slots }) {
    return () => h('div', { class: 'toolbar-stub' }, [
      h('div', { class: 'toolbar-stub-start' }, slots.start?.()),
      h('div', { class: 'toolbar-stub-center' }, slots.center?.()),
      h('div', { class: 'toolbar-stub-end' }, slots.end?.()),
    ])
  },
})

const ButtonStub = defineComponent({
  name: 'ButtonStub',
  inheritAttrs: false,
  emits: ['click', 'mouseenter', 'mouseleave'],
  setup(_, { attrs, slots, emit }) {
    return () => h(
      'button',
      {
        ...attrs,
        disabled: isDisabledAttribute(attrs.disabled),
        onClick: (event: MouseEvent) => emit('click', event),
        onMouseenter: (event: MouseEvent) => emit('mouseenter', event),
        onMouseleave: (event: MouseEvent) => emit('mouseleave', event),
      },
      [slots.icon?.(), slots.default?.()]
    )
  },
})

const DividerStub = defineComponent({
  name: 'DividerStub',
  setup() {
    return () => h('hr')
  },
})

const SelectStub = defineComponent({
  name: 'SelectStub',
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
  setup(props, { emit, attrs }) {
    return () => h(
      'select',
      {
        ...attrs,
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

export const primeVueStubs = {
  Toolbar: ToolbarStub,
  Button: ButtonStub,
  Divider: DividerStub,
  Select: SelectStub,
}
