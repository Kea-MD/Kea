<script setup lang="ts">
import { computed, ref } from "vue";
import Toolbar from "primevue/toolbar";
import Button from "primevue/button";
import Select from "primevue/select";
import Divider from "primevue/divider";
import ToggleSwitch from "primevue/toggleswitch";
import { useTheme } from "../../../shared/composables/useTheme";
import type { EditorCommand, EditorMode } from "../editorCommands";

interface Props {
    sidebarOpen?: boolean;
    hasOpenFile?: boolean;
    findOpen?: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
    editorMode?: EditorMode;
}

const props = withDefaults(defineProps<Props>(), {
    sidebarOpen: true,
    hasOpenFile: false,
    findOpen: false,
    canUndo: false,
    canRedo: false,
    editorMode: "rendered",
});

const emit = defineEmits<{
    (e: "toggle-sidebar"): void;
    (e: "hover-sidebar", hovering: boolean): void;
    (e: "command", command: EditorCommand): void;
    (e: "set-editor-mode", mode: EditorMode): void;
}>();

const { isDark, toggleTheme } = useTheme();

const canEdit = computed(() => props.hasOpenFile);

const headingOptions = [
    { label: "P", value: "heading-paragraph" as EditorCommand },
    { label: "H1", value: "heading-1" as EditorCommand },
    { label: "H2", value: "heading-2" as EditorCommand },
    { label: "H3", value: "heading-3" as EditorCommand },
    { label: "H4", value: "heading-4" as EditorCommand },
    { label: "H5", value: "heading-5" as EditorCommand },
    { label: "H6", value: "heading-6" as EditorCommand },
];

const listOptions = [
    { label: "format_list_bulleted", value: "bullet-list" as EditorCommand },
    { label: "format_list_numbered", value: "ordered-list" as EditorCommand },
    { label: "checklist", value: "task-list" as EditorCommand },
];

const selectedHeadingCommand = ref<EditorCommand>("heading-paragraph");
const selectedListCommand = ref<EditorCommand>("bullet-list");

function runCommand(command: EditorCommand) {
    emit("command", command);
}

function setHeadingCommand(command: EditorCommand | null) {
    if (!command) return;
    runCommand(command);
}

function setListCommand(command: EditorCommand | null) {
    if (!command) return;
    runCommand(command);
}

function setEditorMode(mode: EditorMode) {
    emit("set-editor-mode", mode);
}

const isSourceMode = computed<boolean>({
    get: () => props.editorMode === "source",
    set: (value) => {
        setEditorMode(value ? "source" : "rendered");
    },
});
</script>

<template>
    <Toolbar class="editor-toolbar">
        <template #start>
            <Button
                severity="secondary"
                text
                :class="{ sidebarOpen }"
                @click="emit('toggle-sidebar')"
                @mouseenter="emit('hover-sidebar', true)"
                @mouseleave="emit('hover-sidebar', false)"
                :title="sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'"
                class="sidebar-toggle-btn"
            >
                <template #icon>
                    <span class="material-symbols-outlined">dock_to_right</span>
                </template>
            </Button>
        </template>

        <template #center>
            <Divider layout="vertical" />

            <Button
                severity="secondary"
                text
                :disabled="!canEdit || !props.canUndo"
                @click="runCommand('undo')"
                title="Undo"
            >
                <template #icon>
                    <span class="material-symbols-outlined">undo</span>
                </template>
            </Button>
            <Button
                severity="secondary"
                text
                :disabled="!canEdit || !props.canRedo"
                @click="runCommand('redo')"
                title="Redo"
            >
                <template #icon>
                    <span class="material-symbols-outlined">redo</span>
                </template>
            </Button>
            <Button
                severity="secondary"
                text
                :disabled="!canEdit"
                :class="{ 'is-active': props.findOpen }"
                @click="runCommand('find')"
                :title="props.findOpen ? 'Close Find' : 'Find'"
            >
                <template #icon>
                    <span class="material-symbols-outlined">search</span>
                </template>
            </Button>

            <Divider layout="vertical" />

            <Button
                severity="secondary"
                text
                :disabled="!canEdit"
                @click="runCommand('bold')"
                title="Bold"
            >
                <template #icon>
                    <span class="material-symbols-outlined">format_bold</span>
                </template>
            </Button>
            <Button
                severity="secondary"
                text
                :disabled="!canEdit"
                @click="runCommand('italic')"
                title="Italic"
            >
                <template #icon>
                    <span class="material-symbols-outlined">format_italic</span>
                </template>
            </Button>
            <Button
                severity="secondary"
                text
                :disabled="!canEdit"
                @click="runCommand('strikethrough')"
                title="Strikethrough"
            >
                <template #icon>
                    <span class="material-symbols-outlined"
                        >format_strikethrough</span
                    >
                </template>
            </Button>
            <Button
                severity="secondary"
                text
                :disabled="!canEdit"
                @click="runCommand('code')"
                title="Inline Code"
            >
                <template #icon>
                    <span class="material-symbols-outlined">code</span>
                </template>
            </Button>
            <Button
                severity="secondary"
                text
                :disabled="!canEdit"
                @click="runCommand('code-block')"
                title="Code Block"
            >
                <template #icon>
                    <span class="material-symbols-outlined">data_object</span>
                </template>
            </Button>
            <Button
                severity="secondary"
                text
                :disabled="!canEdit"
                @click="runCommand('blockquote')"
                title="Blockquote"
            >
                <template #icon>
                    <span class="material-symbols-outlined">format_quote</span>
                </template>
            </Button>
            <Button
                severity="secondary"
                text
                :disabled="!canEdit"
                @click="runCommand('insert-hr')"
                title="Horizontal Rule"
            >
                <template #icon>
                    <span class="material-symbols-outlined"
                        >horizontal_rule</span
                    >
                </template>
            </Button>

            <Divider layout="vertical" />

            <Select
                v-model="selectedHeadingCommand"
                :options="headingOptions"
                optionLabel="label"
                optionValue="value"
                :disabled="!canEdit"
                size="small"
                class="heading-select"
                @update:modelValue="setHeadingCommand"
            />

            <Select
                v-model="selectedListCommand"
                :options="listOptions"
                optionValue="value"
                :disabled="!canEdit"
                size="small"
                class="list-select"
                @update:modelValue="setListCommand"
            >
                <template #value="slotProps">
                    <span
                        v-if="slotProps.value"
                        class="material-symbols-outlined select-icon value-icon"
                    >
                        {{
                            listOptions.find((o) => o.value === slotProps.value)
                                ?.label
                        }}
                    </span>
                    <span
                        v-else
                        class="material-symbols-outlined select-icon value-icon"
                        >format_list_bulleted</span
                    >
                </template>
                <template #option="slotProps">
                    <span class="material-symbols-outlined select-icon">{{
                        slotProps.option.label
                    }}</span>
                </template>
            </Select>

            <Divider layout="vertical" />

            <Button
                severity="secondary"
                text
                :disabled="!canEdit"
                @click="runCommand('insert-link')"
                title="Insert Link"
            >
                <template #icon>
                    <span class="material-symbols-outlined">link</span>
                </template>
            </Button>
            <Button
                severity="secondary"
                text
                :disabled="!canEdit"
                @click="runCommand('insert-image')"
                title="Insert Image"
            >
                <template #icon>
                    <span class="material-symbols-outlined">image</span>
                </template>
            </Button>
            <Button
                severity="secondary"
                text
                :disabled="!canEdit"
                @click="runCommand('insert-highlight')"
                title="Highlight"
            >
                <template #icon>
                    <span class="material-symbols-outlined"
                        >ink_highlighter</span
                    >
                </template>
            </Button>
        </template>

        <template #end>
            <div
                class="mode-toggle"
                :class="{ 'is-source': props.editorMode === 'source' }"
                role="group"
                aria-label="Editor mode"
            >
                <span class="mode-label">Source</span>
                <ToggleSwitch
                    v-model="isSourceMode"
                    input-id="editor-mode-toggle"
                    :disabled="!canEdit"
                    aria-label="Toggle editor mode"
                    class="mode-switch"
                />
            </div>

            <Divider layout="vertical" />

            <Button
                severity="secondary"
                text
                @click="toggleTheme"
                :title="isDark ? 'Light Mode' : 'Dark Mode'"
            >
                <template #icon>
                    <span class="material-symbols-outlined">{{
                        isDark ? "light_mode" : "dark_mode"
                    }}</span>
                </template>
            </Button>
        </template>
    </Toolbar>
</template>

<style scoped>
.editor-toolbar {
    border: none;
    border-radius: 0;
    padding: 0.5rem;
    background: var(--tt-gray-light-200);
    gap: 0.25rem;
    overflow-x: auto;
    overflow-y: hidden;
    flex-wrap: nowrap;
}

.dark .editor-toolbar {
    background: var(--tt-gray-dark-50);
}

.editor-toolbar :deep(.p-toolbar-start),
.editor-toolbar :deep(.p-toolbar-end) {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
}

.editor-toolbar :deep(.p-button) {
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
}

.mode-toggle {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.mode-label {
    font-size: 12px;
    color: var(--tt-gray-light-600);
}

.editor-toolbar :deep(.p-button.is-active) {
    background-color: var(--tt-gray-light-a-200);
}

.editor-toolbar :deep(.mode-switch.p-toggleswitch) {
    transform: scale(0.76);
    transform-origin: center;
}

.editor-toolbar
    :deep(
        .mode-switch:not(.p-disabled):not(.p-toggleswitch-checked)
            .p-toggleswitch-slider
    ) {
    background: var(--tt-gray-light-50) !important;
    border: 1px solid var(--tt-gray-light-400);
}

.editor-toolbar
    :deep(.mode-switch.p-toggleswitch-checked .p-toggleswitch-slider) {
    background: var(--tt-brand-color-500) !important;
    border: 1px solid var(--tt-brand-color-500);
}

.editor-toolbar :deep(.mode-switch .p-toggleswitch-handle) {
    background: var(--tt-gray-light-400) !important;
    box-shadow: none;
}

.editor-toolbar
    :deep(.mode-switch.p-toggleswitch-checked .p-toggleswitch-handle) {
    background: var(--tt-gray-light-200) !important;
}

.dark .editor-toolbar :deep(.p-button.is-active) {
    background-color: var(--tt-gray-dark-a-200);
}

.dark .mode-label {
    color: var(--tt-gray-dark-600);
}

.dark
    .editor-toolbar
    :deep(
        .mode-switch:not(.p-disabled):not(.p-toggleswitch-checked)
            .p-toggleswitch-slider
    ) {
    background: var(--tt-gray-dark-200) !important;
    border: 1px solid var(--tt-gray-dark-300);
}

.dark .editor-toolbar :deep(.mode-switch .p-toggleswitch-handle) {
    background: var(--tt-gray-dark-100) !important;
}

.mode-toggle.is-source .mode-label {
    color: var(--tt-gray-light-700);
}

.dark .mode-toggle.is-source .mode-label {
    color: var(--tt-gray-dark-700);
}

.editor-toolbar :deep(.material-symbols-outlined) {
    font-size: 18px;
    color: var(--tt-gray-light-500);
}

.dark .editor-toolbar :deep(.material-symbols-outlined) {
    color: var(--tt-gray-dark-500);
}

.heading-select,
.list-select {
    width: 60px;
    height: 25px;
}

.editor-toolbar :deep(.p-select) {
    border-radius: 8px;
    border: 1px solid var(--tt-gray-light-300);
    background: var(--tt-gray-light-100);
    color: var(--tt-gray-light-700);
    box-shadow: none;
}

.editor-toolbar :deep(.p-select.p-focus) {
    border-color: var(--tt-gray-light-400);
    box-shadow: none;
}

.editor-toolbar :deep(.p-select .p-select-label) {
    display: flex;
    align-items: center;
    line-height: 1;
}

.editor-toolbar :deep(.p-select .p-select-dropdown) {
    color: var(--tt-gray-light-500);
}

.editor-toolbar :deep(.p-select.p-disabled) {
    opacity: 1;
    border-color: var(--tt-gray-light-300);
    background: var(--tt-gray-light-200);
    color: var(--tt-gray-light-500);
}

.editor-toolbar :deep(.p-select.p-disabled .p-select-dropdown) {
    color: var(--tt-gray-light-500);
}

.dark .editor-toolbar :deep(.p-select) {
    border-color: var(--tt-gray-dark-300);
    background: var(--tt-gray-dark-100);
    color: var(--tt-gray-dark-700);
}

.dark .editor-toolbar :deep(.p-select.p-focus) {
    border-color: var(--tt-gray-dark-400);
}

.dark .editor-toolbar :deep(.p-select .p-select-dropdown) {
    color: var(--tt-gray-dark-500);
}

.dark .editor-toolbar :deep(.p-select.p-disabled) {
    border-color: var(--tt-gray-dark-300);
    background: var(--tt-gray-dark-200);
    color: var(--tt-gray-dark-500);
}

.dark .editor-toolbar :deep(.p-select.p-disabled .p-select-dropdown) {
    color: var(--tt-gray-dark-500);
}

.select-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    line-height: 1;
    vertical-align: middle;
}

.value-icon {
    transform: translateY(1px);
}
</style>
