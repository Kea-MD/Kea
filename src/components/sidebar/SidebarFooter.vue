<script setup lang="ts">
import Button from 'primevue/button'

interface Props {
  userName?: string
}

withDefaults(defineProps<Props>(), {
  userName: 'User'
})

const emit = defineEmits<{
  (e: 'feedback'): void
  (e: 'settings'): void
}>()
</script>

<template>
  <footer class="sidebar-footer">
    <div class="user">
      <div class="avatar"></div>
      <span class="name">{{ userName }}</span>
    </div>
    <Button
      severity="secondary"
      text
      rounded
      aria-label="Feedback"
      class="footer-btn"
      @click="emit('feedback')"
    >
      <template #icon>
        <span class="material-symbols-outlined">edit_square</span>
      </template>
    </Button>
    <Button
      severity="secondary"
      text
      rounded
      aria-label="Settings"
      class="footer-btn"
      @click="emit('settings')"
    >
      <template #icon>
        <span class="material-symbols-outlined">settings</span>
      </template>
    </Button>
  </footer>
</template>

<style scoped>
.sidebar-footer {
  padding: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  font-size: 0.875rem;
}

.avatar {
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.name {
  color: rgba(255, 255, 255, 0.8);
}

.footer-btn {
  width: 32px;
  height: 32px;
  padding: 0;
}
</style>
