import { createApp } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import editor from "./pages/editor.vue";
import "./styles/global.css";

createApp(editor).mount("#app");

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
