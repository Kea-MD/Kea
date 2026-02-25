<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useTheme } from '../../../shared/composables/useTheme'
import { useSettingsStore } from '../state/settingsStore'

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

type ThemeModeOption = 'light' | 'dark' | 'system'

const settingsStore = useSettingsStore()
const { themeMode, setThemeMode } = useTheme()

const themeOptions: Array<{ label: string; value: ThemeModeOption }> = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]

const selectedThemeMode = computed<ThemeModeOption>({
  get: () => themeMode.value,
  set: (value) => {
    setThemeMode(value)
  },
})

const restoreWorkspaceOnLaunch = computed<boolean>({
  get: () => settingsStore.restoreWorkspaceOnLaunch,
  set: (value) => {
    settingsStore.setRestoreWorkspaceOnLaunch(value)
  },
})

function handleVisibleUpdate(nextVisible: boolean): void {
  if (!nextVisible) {
    emit('close')
  }
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    header="Settings"
    :draggable="false"
    class="settings-dialog"
    @update:visible="handleVisibleUpdate"
  >
    <div class="settings-layout">
      <section class="settings-section" aria-labelledby="appearance-settings-title">
        <h3 id="appearance-settings-title" class="section-title">Appearance</h3>
        <div class="setting-row">
          <div class="setting-copy">
            <p class="setting-label">Theme</p>
            <p class="setting-description">Choose light, dark, or follow your system theme.</p>
          </div>
          <Select
            v-model="selectedThemeMode"
            :options="themeOptions"
            optionLabel="label"
            optionValue="value"
            class="setting-select"
          />
        </div>
      </section>

      <section class="settings-section" aria-labelledby="workspace-settings-title">
        <h3 id="workspace-settings-title" class="section-title">Workspace</h3>
        <div class="setting-row">
          <div class="setting-copy">
            <p class="setting-label">Restore previous workspace on launch</p>
            <p class="setting-description">Re-open your last folder automatically when Kea starts.</p>
          </div>
          <ToggleSwitch
            v-model="restoreWorkspaceOnLaunch"
            input-id="restore-workspace-on-launch"
            aria-label="Restore previous workspace on launch"
            class="setting-toggle"
          />
        </div>
      </section>

      <p class="future-note">More settings will appear here as Kea grows.</p>
    </div>
  </Dialog>
</template>

<style scoped>
:deep(.settings-dialog) {
  width: min(640px, calc(100vw - 32px));
}

:deep(.settings-dialog .p-dialog-header),
:deep(.settings-dialog .p-dialog-content) {
  background: var(--tt-gray-light-100);
}

.dark :deep(.settings-dialog .p-dialog-header),
.dark :deep(.settings-dialog .p-dialog-content) {
  background: var(--tt-gray-dark-100);
}

.settings-layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-section {
  border: 1px solid var(--tt-gray-light-a-200);
  border-radius: 12px;
  background: var(--tt-gray-light-50);
  padding: 12px;
}

.dark .settings-section {
  border-color: var(--tt-gray-dark-a-200);
  background: var(--tt-gray-dark-50);
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tt-gray-light-700);
  margin-bottom: 10px;
}

.dark .section-title {
  color: var(--tt-gray-dark-700);
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
}

.setting-copy {
  min-width: 0;
}

.setting-label {
  font-size: 13px;
  color: var(--tt-gray-light-700);
}

.dark .setting-label {
  color: var(--tt-gray-dark-700);
}

.setting-description {
  margin-top: 4px;
  font-size: 12px;
  color: var(--tt-gray-light-500);
}

.dark .setting-description {
  color: var(--tt-gray-dark-500);
}

.setting-select {
  width: 130px;
  flex-shrink: 0;
}

.setting-toggle {
  flex-shrink: 0;
}

:deep(.setting-toggle:not(.p-toggleswitch-checked) .p-toggleswitch-slider) {
  background: var(--tt-gray-light-400) !important;
  border: 1px solid var(--tt-gray-light-500);
}

:deep(.setting-toggle.p-toggleswitch-checked .p-toggleswitch-slider) {
  background: var(--tt-brand-color-500) !important;
  border: 1px solid transparent;
}

:deep(.setting-toggle .p-toggleswitch-handle) {
  background: var(--tt-gray-light-50) !important;
}

.dark :deep(.setting-toggle:not(.p-toggleswitch-checked) .p-toggleswitch-slider) {
  background: var(--tt-gray-dark-500) !important;
  border-color: var(--tt-gray-dark-600);
}

.dark :deep(.setting-toggle .p-toggleswitch-handle) {
  background: var(--tt-gray-light-50);
}

.future-note {
  font-size: 12px;
  color: var(--tt-gray-light-500);
  text-align: right;
}

.dark .future-note {
  color: var(--tt-gray-dark-500);
}

@media (max-width: 640px) {
  .setting-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .setting-select {
    width: 100%;
  }
}
</style>
