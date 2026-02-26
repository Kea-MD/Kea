<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import {
    Editor,
    defaultValueCtx,
    editorViewCtx,
    rootCtx,
} from "@milkdown/kit/core";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { nord } from "@milkdown/theme-nord";
import { useDocumentStore } from "../state/documentStore";
import "@milkdown/theme-nord/style.css";

const documentStore = useDocumentStore();
const editorRoot = ref<HTMLDivElement | null>(null);
const isReady = ref(false);
const errorMessage = ref("");

let milkdownEditor: Editor | null = null;
let isDestroyed = false;

const createMilkdownEditor = async () => {
    const root = editorRoot.value;
    if (!root || milkdownEditor) return;

    try {
        const editor = await Editor.make()
            .config(nord)
            .config((ctx) => {
                ctx.set(rootCtx, root);
                ctx.set(
                    defaultValueCtx,
                    documentStore.currentFile?.content ?? "",
                );

                const listenerPlugin = ctx.get(listenerCtx);
                listenerPlugin.markdownUpdated(
                    (_ctx, markdown, prevMarkdown) => {
                        if (markdown === prevMarkdown) return;
                        documentStore.updateContent(markdown);
                    },
                );
            })
            .use(commonmark)
            .use(gfm)
            .use(clipboard)
            .use(history)
            .use(listener)
            .create();

        if (isDestroyed) {
            editor.destroy();
            return;
        }

        milkdownEditor = editor;
        isReady.value = true;
        errorMessage.value = "";
        editor.action((ctx) => {
            ctx.get(editorViewCtx).focus();
        });
        console.log("Editor created");
    } catch (error) {
        console.error("Failed to create Milkdown editor:", error);
        errorMessage.value = "Failed to initialise Milkdown editor.";
    }
};

onMounted(() => {
    void createMilkdownEditor();
});

onUnmounted(() => {
    isDestroyed = true;
    milkdownEditor?.destroy();
    milkdownEditor = null;
});
</script>

<template>
    <div class="milkdown-editor-shell">
        <div v-if="!isReady && !errorMessage" class="milkdown-status">
            Loading editor...
        </div>
        <div v-if="errorMessage" class="milkdown-status is-error">
            {{ errorMessage }}
        </div>
        <div ref="editorRoot" class="milkdown-editor" />
    </div>
</template>

<style scoped>
.milkdown-editor-shell {
    width: 100%;
    height: 100%;
    min-height: 0;
    position: relative;
}

.milkdown-editor {
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: auto;
    padding: 10px 100px 10px 100px;
}

.milkdown-status {
    position: absolute;
    top: 12px;
    right: 16px;
    z-index: 2;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    background: var(--tt-gray-light-100);
    color: var(--tt-gray-light-700);
}

.milkdown-status.is-error {
    background: rgba(207, 34, 46, 0.12);
    color: #b42318;
}

.dark .milkdown-status {
    background: var(--tt-gray-dark-100);
    color: var(--tt-gray-dark-700);
}

.milkdown-editor :deep(.milkdown) {
    min-height: 100%;
}

.milkdown-editor :deep(.milkdown .editor) {
    min-height: 100%;
}
</style>
