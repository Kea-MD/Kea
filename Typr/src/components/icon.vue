<script setup lang="ts">
interface Props {
  name: string
  className?: string
  size?: 'small' | 'medium' | 'large'
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold'
}

withDefaults(defineProps<Props>(), {
  size: 'medium',
  weight: 'normal',
  className: ''
})
</script>

<template>
  <span
    :class="[
      'material-symbols-outlined',
      `icon--${size}`,
      `icon--${weight}`,
      className
    ]"
  >
    {{ name }}
  </span>
</template>

<style scoped>
/* Size variants */
.icon--small {
  font-size: 1.5rem !important;
  font-weight: 300;
}

.icon--medium {
  font-size: 1.75rem !important;
  font-weight: 400;
}

.icon--large {
  font-size: 2.5rem !important;
  font-weight: 500;
}

/* Weight variants */
.icon--light {
  font-weight: 300;
}

.icon--normal {
  font-weight: 400;
}

.icon--medium {
  font-weight: 500;
}

.icon--semibold {
  font-weight: 600;
}

.icon--bold {
  font-weight: 700;
}
</style>

