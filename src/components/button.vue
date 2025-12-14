<script setup lang="ts">
import Icon from './icon.vue'

interface Props {
  icon?: string
  text?: string
  variant?: 'primary' | 'secondary'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  onClick?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'medium',
  disabled: false
})

const emit = defineEmits<{
  click: []
}>()

const handleClick = () => {
  if (!props.disabled && props.onClick) {
    props.onClick()
  }
  if (!props.disabled) {
    emit('click')
  }
}
</script>

<template>
  <button
    :class="[
      'button',
      `button--${variant}`,
      `button--${size}`,
      { 'button--disabled': disabled }
    ]"
    :disabled="disabled"
    @click="handleClick"
    type="button"
  >
    <Icon v-if="icon" :name="icon" :size="size" class="button-icon" />
    <span v-if="text" class="button-text">{{ text }}</span>
  </button>
</template>

<style scoped>
.button {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  user-select: none;
  background-color: transparent;
  border: none;
}

/* Variants */
.button--primary {
  color: var(--primary);
}

.button--secondary {
  color: var(--secondary);
}

.button--primary:hover:not(.button--disabled) {
  opacity: 0.5;
}

.button--secondary:hover:not(.button--disabled) {
  opacity: 0.5;
}

.button--primary:active:not(.button--disabled) {
  color: var(--background);
  opacity: 0.7;
}

.button--secondary:active:not(.button--disabled) {
  color: var(--foreground);
  opacity: 0.7;
}

/* Sizes */
.button--small {
  font-size: 1rem;
  font-weight: 400;
  gap: 0.3rem;
}

.button--medium {
  font-size: 1.5rem;
  font-weight: 600;
  gap: 0.4rem;
}

.button--large {
  font-size: 2rem;
  font-weight: 800;
  gap: 0.5rem;
}

/* States */
.button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Icon and Text */
.button-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.button-text {
  font-weight: inherit;
  white-space: nowrap;
}
</style>

