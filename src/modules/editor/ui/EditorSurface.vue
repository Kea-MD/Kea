<script setup lang="ts">
import { computed } from "vue";
import { useAutoSave } from "../runtime/useAutoSave";
import { useDocumentStore } from "../state/documentStore";
import EditorEmptyState from "./EditorEmptyState.vue";
import MilkdownEditor from "./MilkdownEditor.vue";

const documentStore = useDocumentStore();

useAutoSave(2000);

const hasOpenFile = computed(() => documentStore.currentFile !== null);
</script>

<template>
    <div class="editor-container">
        <Transition name="fade">
            <EditorEmptyState v-if="!hasOpenFile" />
        </Transition>

        <div v-if="hasOpenFile" class="editor-layout">
            <MilkdownEditor
                :key="documentStore.activeDocumentId ?? 'milkdown'"
            />
        </div>
    </div>
</template>

<style scoped>
.editor-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.editor-layout {
    width: 100%;
    height: 100%;
    min-height: 0;
}

.editor-layout {
    flex: 1;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
