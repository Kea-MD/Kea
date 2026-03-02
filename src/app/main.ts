import { createApp } from "vue";
import { createPinia } from "pinia";
import { getCurrentWindow } from "@tauri-apps/api/window";
import PrimeVue from "primevue/config";
import Tooltip from "primevue/tooltip";
import Aura from "@primevue/themes/aura";
import EditorApp from "./EditorApp.vue";
import { isTauriRuntime } from "../shared/platform/runtime";
import "../styles/global.css";
import "primeicons/primeicons.css";

// Apply web-platform class if not running in Tauri
if (!isTauriRuntime()) {
  document.body.classList.add("web-platform");
}

const app = createApp(EditorApp);
const pinia = createPinia();

// Install Pinia
app.use(pinia);

// Configure PrimeVue with Aura theme and dark mode support
app.use(PrimeVue, {
  appendTo: "self",
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: ".dark",
      cssLayer: false,
    },
  },
});

app.directive("tooltip", Tooltip);

app.mount("#app");

// Enable window dragging for elements with data-tauri-drag-region attribute
document.addEventListener("mousedown", async (e) => {
  let target = e.target as HTMLElement | null;
  // Check the clicked element and its ancestors for the drag region attribute
  while (target) {
    if (target.hasAttribute("data-tauri-drag-region")) {
      await getCurrentWindow().startDragging();
      return;
    }
    target = target.parentElement;
  }
});
