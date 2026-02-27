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
import type { Node as ProseMirrorNode } from "@milkdown/prose/model";
import { TextSelection } from "@milkdown/prose/state";
import type { EditorView as ProseMirrorEditorView } from "@milkdown/prose/view";
import { useDocumentStore } from "../state/documentStore";
import {
    getRenderedViewportRestore,
    recordRenderedViewportSnapshot,
} from "../runtime/editorViewportSync";
import "@milkdown/theme-nord/style.css";

const documentStore = useDocumentStore();
const editorRoot = ref<HTMLDivElement | null>(null);
const isReady = ref(false);
const errorMessage = ref("");

let milkdownEditor: Editor | null = null;
let isDestroyed = false;
let isRestoringViewport = false;
let editorDocumentId: string | null = null;
let milkdownView: ProseMirrorEditorView | null = null;
let removeViewportListeners: (() => void) | null = null;
let activeScrollContainer: HTMLElement | null = null;
let lastKnownScrollRatio = 0;

const clamp = (value: number, min: number, max: number): number => {
    return Math.min(max, Math.max(min, value));
};

const canScroll = (element: HTMLElement): boolean => {
    return element.scrollHeight - element.clientHeight > 1;
};

const hasScrollableStyle = (element: HTMLElement): boolean => {
    const style = window.getComputedStyle(element);
    return (
        style.overflowY === "auto" ||
        style.overflowY === "scroll" ||
        style.overflow === "auto" ||
        style.overflow === "scroll"
    );
};

const resolveScrollContainer = (): HTMLElement | null => {
    const root = editorRoot.value;
    if (!root) return null;

    const candidates: HTMLElement[] = [];

    candidates.push(root);

    const nestedCandidates = root.querySelectorAll<HTMLElement>(
        ".milkdown, .milkdown .editor, .ProseMirror",
    );
    nestedCandidates.forEach((element) => {
        candidates.push(element);
    });

    const fromViewParent = milkdownView?.dom.parentElement;
    if (fromViewParent) {
        candidates.push(fromViewParent as HTMLElement);
    }

    if (milkdownView?.dom) {
        candidates.push(milkdownView.dom);
    }

    const uniqueCandidates = Array.from(new Set(candidates));
    const scrollable = uniqueCandidates.find((element) => canScroll(element));
    if (scrollable) return scrollable;

    const styleScrollable = uniqueCandidates.find((element) =>
        hasScrollableStyle(element),
    );
    if (styleScrollable) return styleScrollable;

    return root;
};

const getScrollContainer = (): HTMLElement | null => {
    if (activeScrollContainer?.isConnected) {
        return activeScrollContainer;
    }

    activeScrollContainer = resolveScrollContainer();

    return activeScrollContainer;
};

const getScrollRatio = (container: HTMLElement): number => {
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return 0;
    return clamp(container.scrollTop / maxScroll, 0, 1);
};

const setScrollByRatio = (container: HTMLElement, ratio: number): void => {
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return;

    const safeRatio = Number.isFinite(ratio) ? clamp(ratio, 0, 1) : 0;
    container.scrollTop = safeRatio * maxScroll;
};

const getPlainText = (): string => {
    if (!milkdownView) return "";
    return milkdownView.state.doc.textBetween(
        0,
        milkdownView.state.doc.content.size,
        "\n",
        "\n",
    );
};

const getCursorPreview = (text: string, offset: number): string => {
    const safeOffset = clamp(Math.round(offset), 0, text.length);
    const start = Math.max(0, safeOffset - 12);
    const end = Math.min(text.length, safeOffset + 12);
    return text.slice(start, end).replace(/\n/g, "\\n");
};

const getPlainPrefixLengthAtPmPos = (
    doc: ProseMirrorNode,
    position: number,
): number => {
    const safePosition = clamp(Math.round(position), 0, doc.content.size);
    return doc.textBetween(0, safePosition, "\n", "\n").length;
};

const mapPmPosToPlainOffset = (
    doc: ProseMirrorNode,
    position: number,
): number => {
    return getPlainPrefixLengthAtPmPos(doc, position);
};

const mapPlainOffsetToPmPos = (
    doc: ProseMirrorNode,
    plainOffset: number,
): number => {
    const fullLength = getPlainPrefixLengthAtPmPos(doc, doc.content.size);
    const safeOffset = clamp(Math.round(plainOffset), 0, fullLength);

    let low = 0;
    let high = doc.content.size;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const midLength = getPlainPrefixLengthAtPmPos(doc, mid);

        if (midLength < safeOffset) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    return low;
};

const publishViewportSnapshot = (): void => {
    if (!milkdownView || !editorDocumentId || isRestoringViewport) return;

    const plainText = getPlainText();
    const pmPos = milkdownView.state.selection.from;
    const plainCursorOffset = mapPmPosToPlainOffset(milkdownView.state.doc, pmPos);
    const container = getScrollContainer();
    const scrollRatio = container
        ? getScrollRatio(container)
        : lastKnownScrollRatio;

    if (container) {
        lastKnownScrollRatio = scrollRatio;
    }

    recordRenderedViewportSnapshot({
        documentId: editorDocumentId,
        plainText,
        plainCursorOffset,
        pmPos,
        scrollRatio,
    });

};

const restoreViewportSnapshot = (): void => {
    if (!milkdownView || !editorDocumentId) return;

    const plainText = getPlainText();
    const restore = getRenderedViewportRestore(editorDocumentId, plainText);
    if (!restore) return;

    const doc = milkdownView.state.doc;
    const pmPos = typeof restore.pmPos === "number"
        ? clamp(Math.round(restore.pmPos), 0, doc.content.size)
        : mapPlainOffsetToPmPos(doc, restore.plainCursorOffset);
    isRestoringViewport = true;

    const selection = pmPos <= 0
        ? TextSelection.atStart(doc)
        : TextSelection.create(doc, pmPos, pmPos);
    const transaction = milkdownView.state.tr.setSelection(selection);
    milkdownView.dispatch(transaction);

    const appliedPmPos = milkdownView.state.selection.from;
    const appliedPlainOffset = mapPmPosToPlainOffset(doc, appliedPmPos);
    console.debug("[viewport-sync][milkdown] cursor restored after switch", {
        documentId: editorDocumentId,
        requestedPlainOffset: restore.plainCursorOffset,
        requestedPmPos: restore.pmPos,
        appliedPmPos,
        appliedPlainOffset,
        preview: getCursorPreview(plainText, appliedPlainOffset),
    });

    const applyScrollRestore = (attempt = 0) => {
        const container = getScrollContainer();
        if (!container) {
            isRestoringViewport = false;
            return;
        }

        setScrollByRatio(container, restore.scrollRatio);
        lastKnownScrollRatio = getScrollRatio(container);

        if (attempt >= 4) {
            isRestoringViewport = false;
            return;
        }

        if (Math.abs(getScrollRatio(container) - restore.scrollRatio) > 0.02) {
            requestAnimationFrame(() => {
                applyScrollRestore(attempt + 1);
            });
        } else {
            isRestoringViewport = false;
        }
    };

    requestAnimationFrame(() => {
        applyScrollRestore();
    });
};

const bindViewportListeners = (): void => {
    if (!milkdownView) return;

    const viewDom = milkdownView.dom;
    activeScrollContainer = resolveScrollContainer();
    const scrollContainer = getScrollContainer();

    const handleViewportChange = () => {
        if (isRestoringViewport) return;
        publishViewportSnapshot();
    };

    viewDom.addEventListener("mouseup", handleViewportChange);
    viewDom.addEventListener("keyup", handleViewportChange);
    viewDom.addEventListener("click", handleViewportChange);
    viewDom.addEventListener("focusin", handleViewportChange);

    if (scrollContainer) {
        scrollContainer.addEventListener("scroll", handleViewportChange, {
            passive: true,
        });
    }

    removeViewportListeners = () => {
        viewDom.removeEventListener("mouseup", handleViewportChange);
        viewDom.removeEventListener("keyup", handleViewportChange);
        viewDom.removeEventListener("click", handleViewportChange);
        viewDom.removeEventListener("focusin", handleViewportChange);

        if (scrollContainer) {
            scrollContainer.removeEventListener("scroll", handleViewportChange);
        }
    };

};

const focusEditorWithoutScrolling = (): void => {
    const focusTarget = milkdownView?.dom;
    if (!focusTarget) return;

    try {
        focusTarget.focus({ preventScroll: true });
    } catch {
        focusTarget.focus();
    }
};

const createMilkdownEditor = async () => {
    const root = editorRoot.value;
    if (!root || milkdownEditor) return;

    editorDocumentId = documentStore.activeDocumentId;

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
                        if (markdown === prevMarkdown || isRestoringViewport) return;
                        documentStore.updateContent(markdown);
                        publishViewportSnapshot();
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

        editor.action((ctx) => {
            milkdownView = ctx.get(editorViewCtx);
        });

        focusEditorWithoutScrolling();
        restoreViewportSnapshot();
        bindViewportListeners();

        isReady.value = true;
        errorMessage.value = "";
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

    if (milkdownView && editorDocumentId) {
        const scrollContainer = getScrollContainer();
        const scrollRatio = scrollContainer
            ? getScrollRatio(scrollContainer)
            : lastKnownScrollRatio;
        const pmPos = milkdownView.state.selection.from;
        const plainCursorOffset = mapPmPosToPlainOffset(milkdownView.state.doc, pmPos);
        const plainText = getPlainText();

        console.debug("[viewport-sync][milkdown] final position before switch", {
            documentId: editorDocumentId,
            pmPos,
            plainCursorOffset,
            scrollRatio,
            preview: getCursorPreview(plainText, plainCursorOffset),
        });
    }

    removeViewportListeners?.();
    removeViewportListeners = null;
    activeScrollContainer = null;
    lastKnownScrollRatio = 0;
    milkdownView = null;
    milkdownEditor?.destroy();
    milkdownEditor = null;
    editorDocumentId = null;
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
