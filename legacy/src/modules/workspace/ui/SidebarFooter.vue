<script setup lang="ts">
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
    <button
      type="button"
      aria-label="Settings"
      title="Settings"
      class="footer-btn"
      @click="emit('settings')"
    >
      <span class="material-symbols-outlined settings-icon">settings</span>
    </button>
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.875rem;
  height: 1.875rem;
  padding: 0;
  background: none;
  border: none;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.15s ease;
}

.footer-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.settings-icon {
  font-size: 1.125rem;
  color: inherit;
}

</style>
