<script setup lang="ts">
import LogoImage from '../assets/Logo/LogoLow.png'
</script>

<template>
  <div class="logo">
    <img :src="LogoImage" alt="Logo" width="auto" height="40" />
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
</style>

