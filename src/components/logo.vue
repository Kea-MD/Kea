<script setup lang="ts">
import LogoImage from '../assets/Logo.svg'
</script>

<template>
  <div class="logo">
    <img :src="LogoImage" alt="Logo" width="32" height="32" />
    <div class="logo-text">
      <span class="logo-text-1">Typr</span>
      <span class="logo-text-2">MD</span>
    </div>
  </div>
</template>

<style scoped>
.logo {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex: 1 0 0;
  align-self: normal;
  color: var(--white);
  font-size: var(--font-size-2xl);
}

.logo-text-1 {
  font-weight: 800;
}

.logo-text-2 {
  font-weight: 200;
}
</style>

