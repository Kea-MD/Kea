<script setup lang="ts">
import { computed, ref } from "vue";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import ToggleSwitch from "primevue/toggleswitch";
import { useTheme } from "../../../shared/composables/useTheme";
import { isMacPlatform } from "../../../shared/platform/runtime";
import {
    formatShortcutForDisplay,
    shortcutDefinitions,
    shortcutFromKeyboardEvent,
    type ShortcutActionId,
} from "../shortcuts/shortcutRegistry";
import { useSettingsStore } from "../state/settingsStore";

interface Props {
    visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: "close"): void;
}>();

type ThemeModeOption = "light" | "dark" | "system";

const settingsStore = useSettingsStore();
const { themeMode, setThemeMode } = useTheme();
const editingShortcutId = ref<ShortcutActionId | null>(null);
const shortcutErrorMessage = ref("");

const isMac = isMacPlatform();

const themeOptions: Array<{ label: string; value: ThemeModeOption }> = [
    { label: "System", value: "system" },
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
];

const selectedThemeMode = computed<ThemeModeOption>({
    get: () => themeMode.value,
    set: (value) => {
        setThemeMode(value);
    },
});

const restoreWorkspaceOnLaunch = computed<boolean>({
    get: () => settingsStore.restoreWorkspaceOnLaunch,
    set: (value) => {
        settingsStore.setRestoreWorkspaceOnLaunch(value);
    },
});

const edgeGlowEnabled = computed<boolean>({
    get: () => settingsStore.edgeGlowEnabled,
    set: (value) => {
        settingsStore.setEdgeGlowEnabled(value);
    },
});

const shortcutGroups = computed(() => {
    return ["File", "Edit", "View"].map((category) => ({
        category,
        shortcuts: shortcutDefinitions.filter(
            (definition) => definition.category === category,
        ),
    }));
});

function shortcutText(actionId: ShortcutActionId): string {
    return formatShortcutForDisplay(
        settingsStore.shortcuts[actionId],
        isMac,
    );
}

function startShortcutEdit(actionId: ShortcutActionId): void {
    editingShortcutId.value = actionId;
    shortcutErrorMessage.value = "";
    settingsStore.setShortcutCaptureActive(true);
}

function stopShortcutEdit(): void {
    editingShortcutId.value = null;
    shortcutErrorMessage.value = "";
    settingsStore.setShortcutCaptureActive(false);
}

function clearShortcut(actionId: ShortcutActionId): void {
    settingsStore.setShortcut(actionId, "");
    shortcutErrorMessage.value = "";

    if (editingShortcutId.value === actionId) {
        stopShortcutEdit();
    }
}

function resetShortcut(actionId: ShortcutActionId): void {
    settingsStore.resetShortcut(actionId);
    shortcutErrorMessage.value = "";
}

function resetAllShortcuts(): void {
    settingsStore.resetAllShortcuts();
    stopShortcutEdit();
}

function handleShortcutCapture(
    actionId: ShortcutActionId,
    event: KeyboardEvent,
): void {
    if (editingShortcutId.value !== actionId) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key === "Escape"
    ) {
        stopShortcutEdit();
        return;
    }

    const nextShortcut = shortcutFromKeyboardEvent(event);
    if (!nextShortcut) {
        return;
    }

    const wasSet = settingsStore.setShortcut(actionId, nextShortcut);
    if (!wasSet) {
        shortcutErrorMessage.value =
            "Shortcut must include Ctrl/Cmd or Alt and a non-modifier key.";
        return;
    }

    stopShortcutEdit();
}

function handleVisibleUpdate(nextVisible: boolean): void {
    if (!nextVisible) {
        stopShortcutEdit();
        emit("close");
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
            <section
                class="settings-section"
                aria-labelledby="appearance-settings-title"
            >
                <h3 id="appearance-settings-title" class="section-title">
                    Appearance
                </h3>
                <div class="setting-row">
                    <div class="setting-copy">
                        <p class="setting-label">Theme</p>
                        <p class="setting-description">
                            Choose light, dark, or follow your system theme.
                        </p>
                    </div>
                    <Select
                        v-model="selectedThemeMode"
                        :options="themeOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="setting-select"
                    />
                </div>
                <div class="setting-row">
                    <div class="setting-copy">
                        <p class="setting-label">Edge glow effect</p>
                        <p class="setting-description">
                            Show the mouse glow trail around the window edge.
                        </p>
                    </div>
                    <ToggleSwitch
                        v-model="edgeGlowEnabled"
                        input-id="edge-glow-enabled"
                        aria-label="Toggle edge glow effect"
                        class="setting-toggle"
                    />
                </div>
            </section>

            <section
                class="settings-section"
                aria-labelledby="workspace-settings-title"
            >
                <h3 id="workspace-settings-title" class="section-title">
                    Workspace
                </h3>
                <div class="setting-row">
                    <div class="setting-copy">
                        <p class="setting-label">
                            Restore previous workspace on launch
                        </p>
                        <p class="setting-description">
                            Re-open your last folder automatically when Kea
                            starts.
                        </p>
                    </div>
                    <ToggleSwitch
                        v-model="restoreWorkspaceOnLaunch"
                        input-id="restore-workspace-on-launch"
                        aria-label="Restore previous workspace on launch"
                        class="setting-toggle"
                    />
                </div>
            </section>

            <section
                class="settings-section"
                aria-labelledby="shortcut-settings-title"
            >
                <div class="shortcut-header">
                    <h3 id="shortcut-settings-title" class="section-title">
                        Shortcuts
                    </h3>
                    <button
                        type="button"
                        class="shortcut-link"
                        title="Reset all shortcuts"
                        @click="resetAllShortcuts"
                    >
                        Reset all
                    </button>
                </div>

                <div
                    v-for="group in shortcutGroups"
                    :key="group.category"
                    class="shortcut-group"
                >
                    <h4 class="shortcut-group-title">{{ group.category }}</h4>

                    <div
                        v-for="shortcut in group.shortcuts"
                        :key="shortcut.id"
                        class="setting-row shortcut-row"
                    >
                        <div class="setting-copy">
                            <p class="setting-label">{{ shortcut.label }}</p>
                            <p class="setting-description">
                                {{ shortcut.description }}
                            </p>
                        </div>

                        <div class="shortcut-controls">
                            <button
                                type="button"
                                class="shortcut-chip"
                                :class="{
                                    'is-capturing':
                                        editingShortcutId === shortcut.id,
                                }"
                                :title="
                                    editingShortcutId === shortcut.id
                                        ? 'Press a key combination'
                                        : 'Edit shortcut'
                                "
                                @click="startShortcutEdit(shortcut.id)"
                                @keydown="
                                    handleShortcutCapture(shortcut.id, $event)
                                "
                            >
                                {{
                                    editingShortcutId === shortcut.id
                                        ? "Press keys..."
                                        : shortcutText(shortcut.id)
                                }}
                            </button>
                            <button
                                type="button"
                                class="shortcut-link"
                                title="Reset this shortcut"
                                @click="resetShortcut(shortcut.id)"
                            >
                                Reset
                            </button>
                            <button
                                type="button"
                                class="shortcut-link"
                                title="Clear this shortcut"
                                @click="clearShortcut(shortcut.id)"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>

                <p v-if="shortcutErrorMessage" class="shortcut-error">
                    {{ shortcutErrorMessage }}
                </p>
            </section>
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

.setting-row + .setting-row {
    margin-top: 10px;
}

.shortcut-row {
    align-items: flex-start;
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

.shortcut-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 4px;
}

.shortcut-group + .shortcut-group {
    margin-top: 10px;
}

.shortcut-group-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--tt-gray-light-600);
    margin-bottom: 8px;
}

.dark .shortcut-group-title {
    color: var(--tt-gray-dark-600);
}

.shortcut-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.shortcut-chip {
    min-width: 122px;
    border: 1px solid var(--tt-gray-light-300);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 600;
    background: var(--tt-gray-light-100);
    color: var(--tt-gray-light-700);
    text-align: center;
}

.shortcut-chip.is-capturing {
    border-color: var(--tt-brand-color-500);
    box-shadow: 0 0 0 1px rgba(var(--tt-brand-color-rgb), 0.3);
}

.dark .shortcut-chip {
    border-color: var(--tt-gray-dark-300);
    background: var(--tt-gray-dark-200);
    color: var(--tt-gray-dark-700);
}

.shortcut-link {
    border: none;
    padding: 0;
    background: transparent;
    color: var(--tt-brand-color-500);
    font-size: 12px;
    cursor: pointer;
}

.shortcut-link:hover {
    text-decoration: underline;
}

.shortcut-error {
    margin-top: 8px;
    font-size: 12px;
    color: #b42318;
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

.dark
    :deep(.setting-toggle:not(.p-toggleswitch-checked) .p-toggleswitch-slider) {
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

    .shortcut-controls {
        width: 100%;
        justify-content: flex-start;
    }
}
</style>
