<script setup lang="ts">
import { computed, ref } from "vue";
import EditorSurface from "../modules/editor/ui/EditorSurface.vue";
import Sidebar from "../modules/workspace/ui/Sidebar.vue";
import EditorTabs from "../modules/editor/ui/EditorTabs.vue";
import EditorToolbar from "../modules/editor/ui/EditorToolbar.vue";
import ExternalChangeBanner from "../modules/editor/ui/ExternalChangeBanner.vue";
import QuickOpenDialog from "../modules/workspace/ui/QuickOpenDialog.vue";
import SettingsDialog from "../modules/settings/ui/SettingsDialog.vue";
import { useSettingsStore } from "../modules/settings/state/settingsStore";
import MouseRingGlow from "./ui/MouseRingGlow.vue";
import { useTheme } from "../shared/composables/useTheme";
import { useSidebarResize } from "../modules/workspace/runtime/useSidebarResize";
import { useExternalFileSync } from "../modules/workspace/runtime/useExternalFileSync";
import { useSidebarInteraction } from "../modules/workspace/runtime/useSidebarInteraction";
import { useDocumentStore } from "../modules/editor/state/documentStore";
import { useEditorUiState } from "./runtime/useEditorUiState";
import { useEditorAppActions } from "./runtime/useEditorAppActions";

const documentStore = useDocumentStore();
const settingsStore = useSettingsStore();
const hasOpenFile = computed(() => documentStore.activeDocument !== null);
const editorMode = computed(() => documentStore.editorMode);
const pageElement = ref<HTMLElement | null>(null);

useTheme();
useExternalFileSync();

const { sidebarWidth, isResizing, startResize } = useSidebarResize();
const { sidebarOpen, sidebarHovering, toggleSidebar, handleSidebarHover } =
    useSidebarInteraction();
const { isFindOpen, canUndo, canRedo } = useEditorUiState();
const {
    showQuickSwitcher,
    showSettingsDialog,
    closeQuickSwitcher,
    closeSettings,
    handleNewRequest,
    handleFeedback,
    handleSettings,
    handleEditorCommand,
    handleEditorMode,
} = useEditorAppActions({ toggleSidebar });
</script>

<template>
    <div ref="pageElement" class="page">
        <MouseRingGlow v-if="settingsStore.edgeGlowEnabled" :host-element="pageElement" />
        <div class="topDragRegion" data-tauri-drag-region></div>
        <div class="pageContainer">
            <div
                class="layout"
                :class="{
                    'sidebar-open': sidebarOpen,
                    'is-resizing': isResizing,
                }"
                :style="
                    sidebarOpen
                        ? { gridTemplateColumns: `${sidebarWidth}px 1fr` }
                        : undefined
                "
            >
                <Sidebar
                    :is-open="sidebarOpen"
                    :is-hovering="sidebarHovering"
                    :width="sidebarWidth"
                    @new-request="handleNewRequest"
                    @feedback="handleFeedback"
                    @settings="handleSettings"
                />

                <!-- Resize handle -->
                <div
                    v-if="sidebarOpen"
                    class="resize-handle"
                    :class="{ 'is-resizing': isResizing }"
                    @mousedown="startResize"
                />

                <div class="mainEditor">
                    <div class="editorHeader">
                        <EditorTabs :sidebar-open="sidebarOpen" />
                        <EditorToolbar
                            :sidebar-open="sidebarOpen"
                            :has-open-file="hasOpenFile"
                            :find-open="isFindOpen"
                            :can-undo="canUndo"
                            :can-redo="canRedo"
                            :editor-mode="editorMode"
                            @toggle-sidebar="toggleSidebar"
                            @hover-sidebar="handleSidebarHover"
                            @command="handleEditorCommand"
                            @set-editor-mode="handleEditorMode"
                        />
                        <ExternalChangeBanner />
                    </div>
                    <div class="editorContent">
                        <EditorSurface />
                    </div>
                </div>
            </div>
        </div>

        <!-- Quick Switcher Modal -->
        <QuickOpenDialog v-if="showQuickSwitcher" @close="closeQuickSwitcher" />

        <SettingsDialog :visible="showSettingsDialog" @close="closeSettings" />
    </div>
</template>

<style scoped>
/* Page Layout */
.page {
    --window-radius: 45px;
    --window-inset: 7.5px;
    position: relative;
    display: flex;
    width: 100vw;
    height: 100vh;
    padding: var(--window-inset);
    overflow: hidden;
    border-radius: var(--window-radius);
    clip-path: inset(0 round var(--window-radius));
    contain: paint;
    overscroll-behavior: none;
    isolation: isolate;
}

.topDragRegion {
    position: absolute;
    inset: 0 0 auto 0;
    height: 20px;
    z-index: 9999;
    -webkit-app-region: drag;
}

.pageContainer {
    position: relative;
    z-index: 1;
    width: 100%;
    display: flex;
    padding: var(--window-inset);
    flex: 1;
    background: rgba(10, 10, 10, 0.8);
    border-radius: calc(var(--window-radius) - var(--window-inset));
    overscroll-behavior: none;
}

/* Layout Grid */
.layout {
    width: 100%;
    display: grid;
    grid-template-columns: 0 1fr;
    transition: grid-template-columns 0.16s cubic-bezier(0, 0, 0.58, 1);
}

.layout.sidebar-open {
    grid-template-columns: 260px 1fr;
}

.layout.is-resizing {
    transition: none;
}

/* Resize Handle */
.resize-handle {
    position: absolute;
    top: 40px;
    bottom: 5px;
    width: 8px;
    left: calc(v-bind(sidebarWidth) * 1px + 5px);
    cursor: col-resize;
    z-index: 10;
    border-radius: 4px;
    transition: background 0.15s ease;
}

.resize-handle::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 3px;
    height: 40px;
    border-radius: 2px;
    background: transparent;
    transition: background 0.15s ease;
}

.resize-handle:hover::after,
.resize-handle.is-resizing::after {
    background: var(--tt-gray-light-a-300);
}

.dark .resize-handle:hover::after,
.dark .resize-handle.is-resizing::after {
    background: var(--tt-gray-dark-a-300);
}

/* Main Editor */
.mainEditor {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    border-radius: 30px;
    background: var(--white);
    overflow: hidden;
}

.dark .mainEditor {
    background: var(--tt-gray-dark-a-50);
}

.editorHeader {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
}

.editorContent {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
}
</style>
