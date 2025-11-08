<script setup lang="ts">
</script>

<template>
  <div class="AI_Toolbar">
    <div class="AI_Toolbar_Content">
    </div>
  </div>
</template>

<style scoped>
.AI_Toolbar {
  display: flex;
  padding: var(--space-3);
  flex-direction: column;
  align-items: flex-start;
  align-self: stretch;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}

.AI_Toolbar_Wrapper {
  width: 100%;
  height: 100%;
}

.AI_Toolbar_Content {
  display: flex;
  padding: var(--space-3);
  flex-direction: column;
  align-items: flex-start;
  align-self: stretch;
  border-radius: var(--radius);
  background: var(--surface-secondary);
  backdrop-filter: blur(10px);
  height: 50px;
}
</style>

