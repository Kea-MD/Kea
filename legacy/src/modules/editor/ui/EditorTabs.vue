<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from "vue";
import { useDocumentStore, type OpenDocument } from "../state/documentStore";
import { useRuntimeContext } from "../../../shared/composables/useRuntimeContext";

interface Props {
    sidebarOpen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    sidebarOpen: true,
});

const DRAG_THRESHOLD_PX = 4;
const DRAG_FOLLOW_LERP = 0.28;
const TAB_EDGE_FADE_MAX_PX = 60;
const TAB_EDGE_FADE_LERP = 0.5;
const TAB_EDGE_FADE_SNAP_PX = 0.4;

const documentStore = useDocumentStore();
const runtimeContext = useRuntimeContext();
const tabs = computed(() => documentStore.openTabs);
const hasTabs = computed(() => tabs.value.length > 0);
const activeId = computed(() => documentStore.activeDocumentId);
const shouldApplyTrafficLightsOffset = computed(
    () => !props.sidebarOpen && runtimeContext.hasTrafficLightsInset.value,
);

const tabsContainerRef = ref<HTMLElement | null>(null);
const tabsScrollerRef = ref<HTMLElement | null>(null);
const tabsListRef = ref<HTMLElement | null>(null);

const showLeftFade = ref(false);
const showRightFade = ref(false);
const leftFadePx = ref(0);
const rightFadePx = ref(0);

const suppressNextClick = ref(false);

const pointerDragTabId = ref<string | null>(null);
const pointerDragStartX = ref(0);
const pointerDragStartY = ref(0);
const pointerDragHasMoved = ref(false);

const draggedTabId = ref<string | null>(null);
const pendingDropIndex = ref<number | null>(null);

const dragTranslateX = ref(0);
const dragTranslateTargetX = ref(0);
const dragFollowFrameId = ref<number | null>(null);

const dragOverlayLeft = ref(0);
const dragOverlayTop = ref(0);
const dragOverlayWidth = ref(0);

const dropIndicatorX = ref<number | null>(null);
const fadeAnimationFrameId = ref<number | null>(null);

let tabsResizeObserver: ResizeObserver | null = null;

const isDraggingTabs = computed(() => draggedTabId.value !== null);
const draggedTab = computed(
    () => tabs.value.find((tab) => tab.id === draggedTabId.value) ?? null,
);
const hasDragOverlay = computed(
    () =>
        pointerDragHasMoved.value &&
        draggedTab.value !== null &&
        dragOverlayWidth.value > 0,
);
const showDropIndicator = computed(
    () => isDraggingTabs.value && dropIndicatorX.value !== null,
);

function getTabsList(): HTMLElement | null {
    return tabsListRef.value;
}

function getTabElements(): HTMLElement[] {
    const tabsList = getTabsList();
    if (!tabsList) {
        return [];
    }

    return Array.from(tabsList.querySelectorAll<HTMLElement>("[data-tab-id]"));
}

function clearPointerDragListeners() {
    document.removeEventListener("mousemove", handlePointerDragMove);
    document.removeEventListener("mouseup", handlePointerDragEnd);
}

function stopDragFollowLoop() {
    if (dragFollowFrameId.value !== null) {
        window.cancelAnimationFrame(dragFollowFrameId.value);
        dragFollowFrameId.value = null;
    }
}

function stopFadeAnimationLoop() {
    if (fadeAnimationFrameId.value !== null) {
        window.cancelAnimationFrame(fadeAnimationFrameId.value);
        fadeAnimationFrameId.value = null;
    }
}

function clearPendingDropTarget() {
    pendingDropIndex.value = null;
    dropIndicatorX.value = null;
}

function resetDragOverlayPosition() {
    stopDragFollowLoop();
    dragTranslateX.value = 0;
    dragTranslateTargetX.value = 0;
    dragOverlayLeft.value = 0;
    dragOverlayTop.value = 0;
    dragOverlayWidth.value = 0;
}

function resetPointerDragState() {
    pointerDragTabId.value = null;
    pointerDragStartX.value = 0;
    pointerDragStartY.value = 0;
    pointerDragHasMoved.value = false;
    draggedTabId.value = null;
    clearPendingDropTarget();
    resetDragOverlayPosition();
}

function getTabsContainerRect(): DOMRect | null {
    const tabsScrollerRect =
        tabsScrollerRef.value?.getBoundingClientRect() ?? null;
    if (tabsScrollerRect && tabsScrollerRect.width > 0) {
        return tabsScrollerRect;
    }

    return tabsContainerRef.value?.getBoundingClientRect() ?? null;
}

function handleTabsWheelScroll(event: WheelEvent) {
    const tabsScroller = tabsScrollerRef.value;
    if (!tabsScroller) {
        return;
    }

    const hasHorizontalDelta = Math.abs(event.deltaX) > 0.01;
    if (hasHorizontalDelta || event.deltaY === 0) {
        return;
    }

    if (tabsScroller.scrollWidth <= tabsScroller.clientWidth) {
        return;
    }

    const previousScrollLeft = tabsScroller.scrollLeft;
    tabsScroller.scrollLeft += event.deltaY;
    if (tabsScroller.scrollLeft !== previousScrollLeft) {
        event.preventDefault();
    }
}

function getTabsMaskStyle(): Record<string, string> {
    return {
        "--tabs-mask-left": `${leftFadePx.value}px`,
        "--tabs-mask-right": `${rightFadePx.value}px`,
    };
}

function runFadeAnimationFrame() {
    const targetLeft = showLeftFade.value ? TAB_EDGE_FADE_MAX_PX : 0;
    const targetRight = showRightFade.value ? TAB_EDGE_FADE_MAX_PX : 0;

    const nextLeft =
        leftFadePx.value + (targetLeft - leftFadePx.value) * TAB_EDGE_FADE_LERP;
    const nextRight =
        rightFadePx.value +
        (targetRight - rightFadePx.value) * TAB_EDGE_FADE_LERP;

    leftFadePx.value =
        Math.abs(targetLeft - nextLeft) <= TAB_EDGE_FADE_SNAP_PX
            ? targetLeft
            : nextLeft;
    rightFadePx.value =
        Math.abs(targetRight - nextRight) <= TAB_EDGE_FADE_SNAP_PX
            ? targetRight
            : nextRight;

    if (leftFadePx.value === targetLeft && rightFadePx.value === targetRight) {
        fadeAnimationFrameId.value = null;
        return;
    }

    fadeAnimationFrameId.value = window.requestAnimationFrame(
        runFadeAnimationFrame,
    );
}

function requestFadeAnimationFrame() {
    if (fadeAnimationFrameId.value !== null) {
        return;
    }

    fadeAnimationFrameId.value = window.requestAnimationFrame(
        runFadeAnimationFrame,
    );
}

function updateTabsOverflowState() {
    const tabsScroller = tabsScrollerRef.value;
    if (!tabsScroller) {
        showLeftFade.value = false;
        showRightFade.value = false;
        requestFadeAnimationFrame();
        return;
    }

    const maxScrollLeft = tabsScroller.scrollWidth - tabsScroller.clientWidth;
    if (maxScrollLeft <= 1) {
        showLeftFade.value = false;
        showRightFade.value = false;
        requestFadeAnimationFrame();
        return;
    }

    showLeftFade.value = tabsScroller.scrollLeft > 1;
    showRightFade.value = tabsScroller.scrollLeft < maxScrollLeft - 1;
    requestFadeAnimationFrame();
}

function handleTabsScroll() {
    updateTabsOverflowState();
}

function handleWindowResize(_event: UIEvent) {
    updateTabsOverflowState();
}

function clampClientXToTabBar(clientX: number): number {
    const tabsContainerRect = getTabsContainerRect();
    if (!tabsContainerRect || tabsContainerRect.width <= 0) {
        return clientX;
    }

    if (clientX < tabsContainerRect.left) {
        return tabsContainerRect.left;
    }

    if (clientX > tabsContainerRect.right) {
        return tabsContainerRect.right;
    }

    return clientX;
}

function getClampedDragTranslate(clientX: number): number {
    const rawTranslate = clientX - pointerDragStartX.value;
    const tabsContainerRect = getTabsContainerRect();

    if (
        !tabsContainerRect ||
        tabsContainerRect.width <= 0 ||
        dragOverlayWidth.value <= 0
    ) {
        return rawTranslate;
    }

    const minTranslate = tabsContainerRect.left - dragOverlayLeft.value;
    const maxTranslate =
        tabsContainerRect.right -
        dragOverlayLeft.value -
        dragOverlayWidth.value;

    if (maxTranslate <= minTranslate) {
        return minTranslate;
    }

    if (rawTranslate < minTranslate) {
        return minTranslate;
    }

    if (rawTranslate > maxTranslate) {
        return maxTranslate;
    }

    return rawTranslate;
}

function runDragFollowFrame() {
    if (!draggedTabId.value) {
        stopDragFollowLoop();
        return;
    }

    const nextTranslateX =
        dragTranslateX.value +
        (dragTranslateTargetX.value - dragTranslateX.value) * DRAG_FOLLOW_LERP;

    dragTranslateX.value = nextTranslateX;

    dragFollowFrameId.value = window.requestAnimationFrame(runDragFollowFrame);
}

function startDragFollowLoop() {
    stopDragFollowLoop();
    dragFollowFrameId.value = window.requestAnimationFrame(runDragFollowFrame);
}

function captureDraggedTabRect(id: string) {
    const tabElement = getTabElements().find(
        (element) => element.dataset.tabId === id,
    );
    if (!tabElement) {
        return;
    }

    const rect = tabElement.getBoundingClientRect();
    dragOverlayLeft.value = rect.left;
    dragOverlayTop.value = rect.top;
    dragOverlayWidth.value = rect.width;
}

function updateDropIndicatorPosition(insertionIndex: number) {
    const tabElements = getTabElements();
    if (tabElements.length === 0) {
        dropIndicatorX.value = null;
        return;
    }

    if (insertionIndex <= 0) {
        dropIndicatorX.value = tabElements[0].offsetLeft;
        return;
    }

    if (insertionIndex >= tabElements.length) {
        const lastTab = tabElements[tabElements.length - 1];
        dropIndicatorX.value = lastTab.offsetLeft + lastTab.offsetWidth;
        return;
    }

    const previousTab = tabElements[insertionIndex - 1];
    const nextTab = tabElements[insertionIndex];
    const previousRight = previousTab.offsetLeft + previousTab.offsetWidth;
    dropIndicatorX.value = (previousRight + nextTab.offsetLeft) / 2;
}

function resolveTabIdAtPointer(clientX: number): string | null {
    const tabsList = getTabsList();
    if (!tabsList) {
        return null;
    }

    const tabsListRect = tabsList.getBoundingClientRect();
    const probeY = tabsListRect.top + tabsListRect.height / 2;
    const element = document.elementFromPoint(clientX, probeY);

    if (!(element instanceof Element)) {
        return null;
    }

    const tabElement = element.closest<HTMLElement>("[data-tab-id]");
    return tabElement?.dataset.tabId ?? null;
}

function resolveNearestInsertionIndex(
    clientX: number,
    tabRects: DOMRect[],
): number {
    let insertionIndex = 0;
    let closestDistance = Math.abs(clientX - tabRects[0].left);

    for (let index = 1; index < tabRects.length; index += 1) {
        const boundaryX =
            (tabRects[index - 1].right + tabRects[index].left) / 2;
        const distance = Math.abs(clientX - boundaryX);

        if (distance < closestDistance) {
            closestDistance = distance;
            insertionIndex = index;
        }
    }

    const rightBoundaryDistance = Math.abs(
        clientX - tabRects[tabRects.length - 1].right,
    );
    if (rightBoundaryDistance < closestDistance) {
        insertionIndex = tabRects.length;
    }

    return insertionIndex;
}

function applyPendingInsertionIndex(insertionIndex: number, fromIndex: number) {
    let nextDropIndex =
        insertionIndex > fromIndex ? insertionIndex - 1 : insertionIndex;

    const maxDropIndex = tabs.value.length - 1;
    if (nextDropIndex < 0) {
        nextDropIndex = 0;
    }
    if (nextDropIndex > maxDropIndex) {
        nextDropIndex = maxDropIndex;
    }

    if (nextDropIndex === fromIndex) {
        clearPendingDropTarget();
        return;
    }

    pendingDropIndex.value = nextDropIndex;
    updateDropIndicatorPosition(insertionIndex);
}

function beginPointerDrag(id: string, event: MouseEvent) {
    pointerDragTabId.value = id;
    pointerDragStartX.value = event.clientX;
    pointerDragStartY.value = event.clientY;
    pointerDragHasMoved.value = false;
    draggedTabId.value = null;
    clearPendingDropTarget();
    resetDragOverlayPosition();

    clearPointerDragListeners();
    document.addEventListener("mousemove", handlePointerDragMove);
    document.addEventListener("mouseup", handlePointerDragEnd);
}

function updatePointerDragTarget(clientX: number) {
    if (!draggedTabId.value) {
        return;
    }

    const fromIndex = documentStore.getDocumentIndex(draggedTabId.value);
    if (fromIndex < 0) {
        return;
    }

    const tabElements = getTabElements();
    if (tabElements.length === 0) {
        clearPendingDropTarget();
        return;
    }

    const tabRects = tabElements.map((element) =>
        element.getBoundingClientRect(),
    );
    const hasMeasuredGeometry = tabRects.some(
        (rect) => rect.width > 0 || rect.left !== rect.right,
    );

    if (hasMeasuredGeometry) {
        const insertionIndex = resolveNearestInsertionIndex(clientX, tabRects);
        applyPendingInsertionIndex(insertionIndex, fromIndex);
        return;
    }

    const overTabId = resolveTabIdAtPointer(clientX);
    if (!overTabId) {
        clearPendingDropTarget();
        return;
    }

    const toIndex = documentStore.getDocumentIndex(overTabId);
    if (toIndex < 0 || toIndex === fromIndex) {
        clearPendingDropTarget();
        return;
    }

    const fallbackInsertionIndex = toIndex > fromIndex ? toIndex + 1 : toIndex;
    applyPendingInsertionIndex(fallbackInsertionIndex, fromIndex);
}

function handlePointerDragMove(event: MouseEvent) {
    if (!pointerDragTabId.value) {
        return;
    }

    const distanceX = Math.abs(event.clientX - pointerDragStartX.value);
    const distanceY = Math.abs(event.clientY - pointerDragStartY.value);

    if (!pointerDragHasMoved.value) {
        if (distanceX < DRAG_THRESHOLD_PX && distanceY < DRAG_THRESHOLD_PX) {
            return;
        }

        pointerDragHasMoved.value = true;
        draggedTabId.value = pointerDragTabId.value;
        captureDraggedTabRect(pointerDragTabId.value);
        dragTranslateTargetX.value = getClampedDragTranslate(event.clientX);
        dragTranslateX.value = dragTranslateTargetX.value;
        startDragFollowLoop();
    }

    event.preventDefault();

    const clampedClientX = clampClientXToTabBar(event.clientX);
    dragTranslateTargetX.value = getClampedDragTranslate(clampedClientX);
    updatePointerDragTarget(clampedClientX);
}

function applyPendingReorder(): boolean {
    if (!draggedTabId.value) {
        return false;
    }

    const fromIndex = documentStore.getDocumentIndex(draggedTabId.value);
    const toIndex = pendingDropIndex.value;

    if (fromIndex < 0 || toIndex === null || fromIndex === toIndex) {
        return false;
    }

    documentStore.reorderTabs(fromIndex, toIndex);
    return true;
}

function handlePointerDragEnd(event: MouseEvent) {
    clearPointerDragListeners();

    if (!pointerDragTabId.value) {
        resetPointerDragState();
        return;
    }

    if (!pointerDragHasMoved.value) {
        resetPointerDragState();
        return;
    }

    event.preventDefault();

    const reordered = applyPendingReorder();
    if (reordered) {
        suppressNextClick.value = true;
        window.setTimeout(() => {
            suppressNextClick.value = false;
        }, 0);
    }

    resetPointerDragState();
}

function handleTabMouseDown(event: MouseEvent, id: string) {
    if (event.button === 1) {
        event.preventDefault();
        documentStore.closeDocument(id);
        return;
    }

    if (event.button !== 0) {
        return;
    }

    if (event.target instanceof Element && event.target.closest(".close-btn")) {
        return;
    }

    event.preventDefault();
    beginPointerDrag(id, event);
}

function selectTab(id: string) {
    if (suppressNextClick.value) {
        suppressNextClick.value = false;
        return;
    }

    documentStore.setActiveDocument(id);
}

function closeTab(event: MouseEvent, id: string) {
    event.stopPropagation();
    documentStore.closeDocument(id);
}

function createNewDocument() {
    documentStore.newFile();
}

function getTabStyle(tabId: string): Record<string, string> | undefined {
    if (!hasDragOverlay.value || tabId !== draggedTabId.value) {
        return undefined;
    }

    return {
        width: `${dragOverlayWidth.value}px`,
        left: `${dragOverlayLeft.value}px`,
        top: `${dragOverlayTop.value}px`,
        transform: `translate3d(${dragTranslateX.value}px, 0, 0)`,
    };
}

function getDropIndicatorStyle(): Record<string, string> | undefined {
    if (!showDropIndicator.value || dropIndicatorX.value === null) {
        return undefined;
    }

    return {
        transform: `translate3d(${dropIndicatorX.value}px, 0, 0)`,
    };
}

function getTabClass(tab: OpenDocument) {
    return {
        tab: true,
        "is-active": tab.id === activeId.value,
        "is-dirty": tab.isDirty,
        "is-drag-ghost": tab.id === draggedTabId.value,
    };
}

function getDragOverlayClass(tab: OpenDocument) {
    return {
        tab: true,
        "is-active": tab.id === activeId.value,
        "is-dirty": tab.isDirty,
        "is-dragging": true,
    };
}

onBeforeUnmount(() => {
    window.removeEventListener("resize", handleWindowResize);
    tabsResizeObserver?.disconnect();
    tabsResizeObserver = null;
    clearPointerDragListeners();
    stopDragFollowLoop();
    stopFadeAnimationLoop();
});

onMounted(() => {
    const tabsScroller = tabsScrollerRef.value;
    const tabsList = tabsListRef.value;

    window.addEventListener("resize", handleWindowResize);

    if (typeof ResizeObserver !== "undefined") {
        tabsResizeObserver = new ResizeObserver(() => {
            updateTabsOverflowState();
        });

        if (tabsScroller) {
            tabsResizeObserver.observe(tabsScroller);
        }
        if (tabsList) {
            tabsResizeObserver.observe(tabsList);
        }
    }

    window.requestAnimationFrame(() => {
        updateTabsOverflowState();
    });
});

watch(
    () => tabs.value.length,
    async () => {
        await nextTick();
        updateTabsOverflowState();
    },
);
</script>

<template>
    <div
        class="tab-bar"
        :class="{
            'sidebar-closed': !props.sidebarOpen,
            'traffic-lights-offset': shouldApplyTrafficLightsOffset,
        }"
    >
        <div
            ref="tabsContainerRef"
            class="tabs-container"
            :class="{ 'is-dragging-tabs': isDraggingTabs }"
        >
            <div
                class="tabs-scroll-wrap"
                :class="{
                    'has-left-fade': showLeftFade,
                    'has-right-fade': showRightFade,
                    'has-tabs': hasTabs,
                }"
                :style="getTabsMaskStyle()"
            >
                <div
                    ref="tabsScrollerRef"
                    class="tabs-scroll"
                    @scroll="handleTabsScroll"
                    @wheel="handleTabsWheelScroll"
                >
                    <div ref="tabsListRef" class="tabs-list">
                        <div
                            v-if="showDropIndicator"
                            class="drop-indicator"
                            :style="getDropIndicatorStyle()"
                        ></div>
                        <div
                            v-for="tab in tabs"
                            :key="tab.id"
                            :class="getTabClass(tab)"
                            :data-tab-id="tab.id"
                            @click="selectTab(tab.id)"
                            @mousedown="handleTabMouseDown($event, tab.id)"
                        >
                            <span class="tab-name">{{ tab.name }}</span>
                            <span
                                v-if="tab.isDirty"
                                class="dirty-indicator"
                                title="Unsaved changes"
                            ></span>
                            <button
                                class="close-btn"
                                @click="closeTab($event, tab.id)"
                                title="Close"
                            >
                                <i class="pi pi-times"></i>
                            </button>
                        </div>
                        <button
                            class="new-tab-btn"
                            @click="createNewDocument"
                            title="New document"
                            aria-label="New document"
                        >
                            <i class="pi pi-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div
            v-if="draggedTab && hasDragOverlay"
            :class="getDragOverlayClass(draggedTab)"
            :style="getTabStyle(draggedTab.id)"
        >
            <span class="tab-name">{{ draggedTab.name }}</span>
            <span
                v-if="draggedTab.isDirty"
                class="dirty-indicator"
                title="Unsaved changes"
            ></span>
            <button
                class="close-btn"
                title="Close"
                aria-hidden="true"
                tabindex="-1"
            >
                <i class="pi pi-times"></i>
            </button>
        </div>
    </div>
</template>

<style scoped>
.tab-bar {
    display: flex;
    align-items: flex-start;
    padding: 7px 0px 0px 0px;
    overflow: hidden;
    height: 40px;
    z-index: 1;
}

.tab-bar.traffic-lights-offset {
    padding-left: 58px;
}

.tabs-container {
    display: flex;
    align-items: flex-start;
    width: 100%;
    min-width: 0;
    padding: 0 16px;
    -webkit-user-select: none;
    user-select: none;
}

.tabs-scroll {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.tabs-scroll::-webkit-scrollbar {
    display: none;
}

.tabs-scroll-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
    --tabs-mask-left: 0px;
    --tabs-mask-right: 0px;
}

.tabs-scroll-wrap .tabs-scroll {
    -webkit-mask-image: linear-gradient(
        to right,
        transparent 0,
        #000 var(--tabs-mask-left),
        #000 calc(100% - var(--tabs-mask-right)),
        transparent 100%
    );
    mask-image: linear-gradient(
        to right,
        transparent 0,
        #000 var(--tabs-mask-left),
        #000 calc(100% - var(--tabs-mask-right)),
        transparent 100%
    );
}

.tabs-list {
    display: flex;
    gap: 7px;
    position: relative;
    width: max-content;
    padding-left: 22px;
    padding-right: 22px;
}

.drop-indicator {
    position: absolute;
    top: -2px;
    left: 0;
    width: 2px;
    height: 30px;
    border-radius: 999px;
    background: var(--tt-brand-color-500);
    pointer-events: none;
    z-index: 6;
}

.tab {
    display: flex;
    align-items: top;
    gap: 10px;
    padding: 5px 5px 5px 15px;
    background: var(--tt-gray-light-200);
    border-radius: 13px;
    cursor: pointer;
    color: var(--tt-gray-light-600);
    font-size: 0.8125rem;
    white-space: nowrap;
    max-width: 180px;
    position: relative;
    height: 26px;
}

.tab:hover {
    background: var(--tt-gray-light-200);
    color: var(--tt-gray-light-600);
}

.tab.is-active {
    background: var(--tt-gray-light-200);
    color: var(--tt-brand-color-500);
    font-weight: 600;
    height: 33px;
    border-radius: 13px 13px 0 0;
}

.tab.is-active::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: -22px;
    width: 22px;
    height: 22px;
    background: var(--tt-gray-light-200);
    clip-path: path("M 0 22 L 22 22 L 22 0 Q 22 22 0 22 Z");
    pointer-events: none;
}

.tab.is-active::after {
    content: "";
    position: absolute;
    bottom: 0;
    right: -22px;
    width: 22px;
    height: 22px;
    background: var(--tt-gray-light-200);
    clip-path: path("M 22 22 L 0 22 L 0 0 Q 0 22 22 22 Z");
    pointer-events: none;
}

.tab.is-drag-ghost {
    opacity: 0.45;
    box-shadow: inset 0 0 0 1px var(--tt-gray-light-400);
}

.tab.is-drag-ghost .close-btn {
    opacity: 0 !important;
}

.tab.is-dragging {
    position: fixed;
    margin: 0;
    z-index: 10;
    opacity: 1;
    height: 26px;
    border-radius: 13px;
    box-shadow: inset 0 0 0 1px var(--tt-brand-color-500);
    background: var(--tt-gray-light-200);
    color: var(--tt-gray-light-600);
    font-weight: 500;
    cursor: grabbing;
    pointer-events: none;
}

.tab.is-active.is-drag-ghost,
.tab.is-active.is-dragging {
    height: 26px;
    border-radius: 13px;
}

.tab.is-active.is-dragging {
    color: var(--tt-brand-color-500);
    font-weight: 600;
}

.tab.is-active.is-drag-ghost::before,
.tab.is-active.is-drag-ghost::after,
.tab.is-active.is-dragging::before,
.tab.is-active.is-dragging::after,
.tab.is-drag-ghost::before,
.tab.is-drag-ghost::after,
.tab.is-dragging::before,
.tab.is-dragging::after {
    display: none;
}

.tab-name {
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
}

.dirty-indicator {
    width: 8px;
    height: 8px;
    background: var(--tt-brand-color-500);
    border-radius: 50%;
    flex-shrink: 0;
    margin: 4px;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
}

.close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    border-radius: 3px;
    opacity: 0;
    flex-shrink: 0;
}

.tab:hover .close-btn,
.tab.is-active .close-btn {
    opacity: 0.78;
}

.close-btn:hover {
    opacity: 1 !important;
    background: var(--tt-gray-light-a-200);
}

.tabs-container.is-dragging-tabs .close-btn:hover {
    background: none;
}

.close-btn .pi {
    font-size: 0.625rem;
}

.new-tab-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 13px;
    background: var(--tt-gray-light-200);
    color: var(--tt-gray-light-600);
    cursor: pointer;
    flex-shrink: 0;
}

.new-tab-btn:hover {
    background: var(--tt-gray-light-300);
    color: var(--tt-gray-light-700);
}

.new-tab-btn .pi {
    font-size: 0.625rem;
}

.tab.is-dirty:not(:hover) .close-btn {
    display: none;
}

.tab.is-dirty:hover .dirty-indicator {
    display: none;
}

.dark .tab {
    background: var(--tt-gray-dark-50);
    color: var(--tt-gray-dark-600);
}

.dark .tab:hover {
    background: var(--tt-gray-dark-50);
    color: var(--tt-gray-dark-600);
}

.dark .tab.is-active {
    background: var(--tt-gray-dark-50);
    color: var(--tt-brand-color-500);
}

.dark .tab.is-active::before,
.dark .tab.is-active::after {
    background: var(--tt-gray-dark-50);
}

.dark .tab.is-dragging {
    background: var(--tt-gray-dark-50);
    color: var(--tt-gray-dark-600);
}

.dark .tab.is-active.is-dragging {
    color: var(--tt-brand-color-500);
}

.dark .close-btn:hover {
    background: var(--tt-gray-dark-a-200);
}

.dark .new-tab-btn {
    background: var(--tt-gray-dark-50);
    color: var(--tt-gray-dark-600);
}

.dark .new-tab-btn:hover {
    background: var(--tt-gray-dark-200);
    color: var(--tt-gray-dark-700);
}
</style>
