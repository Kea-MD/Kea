import { computed, onBeforeUnmount, onMounted, readonly, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  getMobileViewportMediaQuery,
  isMacPlatform,
  isTauriRuntime,
} from "../platform/runtime";

function attachMediaQueryListener(
  mediaQuery: MediaQueryList,
  listener: () => void,
): () => void {
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }

  mediaQuery.addListener(listener);
  return () => mediaQuery.removeListener(listener);
}

export function useRuntimeContext() {
  const isTauri = ref(isTauriRuntime());
  const isMac = ref(isMacPlatform());
  const isFullscreen = ref(false);
  const isMobile = ref(false);

  let stopObservers: (() => void) | null = null;

  const syncFullscreenState = async () => {
    if (!isTauri.value) {
      isFullscreen.value = false;
      return;
    }

    try {
      isFullscreen.value = await getCurrentWindow().isFullscreen();
    } catch (error) {
      console.error("Failed to read fullscreen state:", error);
      isFullscreen.value = false;
    }
  };

  const startObservers = async () => {
    isTauri.value = isTauriRuntime();
    isMac.value = isMacPlatform();

    const cleanup: Array<() => void> = [];
    const mobileQuery = getMobileViewportMediaQuery();

    isMobile.value = mobileQuery?.matches ?? false;

    if (mobileQuery) {
      const handleMobileChange = () => {
        isMobile.value = mobileQuery.matches;
      };

      cleanup.push(attachMediaQueryListener(mobileQuery, handleMobileChange));
    }

    if (isTauri.value) {
      try {
        const appWindow = getCurrentWindow();
        const unlistenResize = await appWindow.onResized(() => {
          void syncFullscreenState();
        });

        cleanup.push(unlistenResize);
      } catch (error) {
        console.error("Failed to watch window state:", error);
      }
    } else {
      isFullscreen.value = false;
    }

    stopObservers = () => {
      cleanup.forEach((dispose) => {
        dispose();
      });
    };

    await syncFullscreenState();
  };

  onMounted(() => {
    void startObservers();
  });

  onBeforeUnmount(() => {
    stopObservers?.();
    stopObservers = null;
  });

  const hasTrafficLightsInset = computed(
    () => isTauri.value && isMac.value && !isFullscreen.value,
  );

  return {
    isTauri: readonly(isTauri),
    isMac: readonly(isMac),
    isFullscreen: readonly(isFullscreen),
    isMobile: readonly(isMobile),
    hasTrafficLightsInset,
  };
}
