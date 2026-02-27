# Lessons Learned

## 2026-02-18

- Keep migration execution incremental and simple: land small reversible slices first (feature flag + checklist), then move core architecture in follow-up phases.
- For local-first editor migrations, replace framework-coupled command paths with a neutral command bus before deleting the old editor stack; this keeps UX stable during cutover.
- In rendered/live-preview interactions, avoid `scrollIntoView` on small inline mutations (for example task checkbox toggles) because widget reflow can create unexpected viewport jumps.
- Validate markdown compatibility claims against a real fixture file (`test.md`) and close gaps with explicit parser/renderer plugins instead of ad-hoc regex-only rendering.
- Preserve viewport explicitly around focus/decorations updates in CodeMirror live preview; focus-change dispatches can still shift scroll even when content edits themselves do not request scrolling.
- For block-toggle UX, anchor scroll to a stable neighbouring rendered block (for example the block above active edit), then restore based on DOM position delta after rerender.
- Avoid multi-frame forced scroll restoration loops in editors; they can fight legitimate user scrolling. Prefer CodeMirror's native `scrollSnapshot` effect for deterministic, single-transaction scroll preservation.
- If users report scroll "fighting" during fast interactions, remove all scroll preservation code entirely first and rely on default browser/editor scrolling behaviour before adding any compensation logic back.
- Relative local media rendering in Tauri needs `app.security.assetProtocol` enabled; add a fallback that converts accidental absolute filesystem URLs into `asset://localhost/...` URLs with encoded path segments.

## 2026-02-24

- When the user asks for ruthless simplification, prioritise coarse-grained architecture cuts (for example document-level rendering instead of block-level) before micro-optimising existing complexity.
- Make simplification intent explicit by removing optional feature paths and extension dependencies together, so the codebase and dependency graph get smaller at the same time.
- For large frontend repos, move by domain first (module folders), then by layer (`ui`, `runtime`, `state`) to reduce cross-folder import churn and make ownership obvious.
- When visual polish is followed by a theming request, move style ownership out of component CSS into a user-managed theme directory with a safe default fallback so future styling does not require code edits.
- When a user asks to relocate theme assets in-repo, remove temporary app-data plumbing and keep the source-of-truth theme files under `src/styles/themes` to simplify iteration.
- For shadow-root markdown previews, do not rely on `:host-context(.dark)` for theme switching in desktop webviews; pass dark mode explicitly and toggle a host class (for example `:host(.is-dark)`) instead.
- When layering default theme CSS with user theme CSS, ensure layout-critical properties (for example `max-width`, `padding`, `margin`) are fully overridden, not partially, or stale spacing from defaults will remain.
- If users want theme-only rendering, remove all fallback CSS from the renderer extension entirely; even "safe defaults" can conflict with explicit theming requirements.
- Never hard-import a specific theme asset if users may delete/rename it; use `import.meta.glob` for optional theme discovery so missing files degrade gracefully to unstyled output.
- Theme-only rendering also requires removing rendered-mode container styles outside the shadow theme (for example `cm-content`/`cm-scroller` font or colour rules), not just fallback CSS inside the renderer.
- After removing theme files, verify there are zero rendered-mode specific CSS overrides left in container components (`.is-rendered-mode` rules), otherwise users still perceive non-theme styling.
- For third-party themes authored against Typora export DOM, mirror expected wrapper classes (`typora-export`, `typora-export-content`, `#write`) in the rendered preview structure so selectors resolve as intended.
- For broad theme compatibility, normalise `:root` to `:host` in shadow CSS and propagate dark marker classes (`dark`, `dark-mode`, `is-dark`) into rendered wrappers so non-uniform dark selectors still activate.
- In dark variants of imported themes, avoid hard-coding document background on `#write` unless explicitly wanted; default to `transparent` so the app surface can show through.
- In file-tree rows, selected-state readability should explicitly override per-type icon colours and low-opacity variants so active file/folder text and icons stay white.
- For sidebar icon consistency, avoid PrimeVue severity-driven button colours when matching custom toolbar actions; use a native button (or explicit deep override) so icon colour matches neighbouring action buttons.
- In settings UI, prefer a true toggle switch component for boolean preferences instead of a checkbox + text state, to match desktop settings conventions and improve at-a-glance clarity.
- In empty-state action panels, keep keyboard shortcut hints laid out in the same column/grid structure as their corresponding buttons; inline bullet text tends to look misaligned and cramped.
- PrimeVue select controls can retain theme accent (blue) even when disabled; explicitly style disabled/focus/select label states in toolbars to keep neutral grey UI when no file is open.
- CodeMirror can show a default dotted focus outline from base styles; add an explicit `.cm-editor.cm-focused { outline: none; }` override in editor host styles when the app uses its own focus treatment.
- PrimeVue ToggleSwitch off-state colour may need explicit non-checked selectors (and occasionally `!important`) to override theme defaults that otherwise keep a blue tint.
- After neutralising ToggleSwitch off-state from brand tint, verify contrast target with the user and be ready to step it up one token (`light-300/400`, `dark-400/500`) if they ask for a darker track.
- For CodeMirror layout spacing, avoid wrapper `padding-top` that shifts the whole editor frame; place vertical spacing on `.cm-content` so it belongs to line content (first line) instead.
- For CodeMirror text selection theming, style both `.cm-selectionBackground` and native `::selection` inside `.cm-content` to ensure the brand highlight appears consistently across focused and native selection paths.

## 2026-02-25

- When the user pivots from migration to a clean-slate reset, remove the existing runtime end-to-end first (UI host + runtime modules) before adding replacement abstractions.
- During large dependency/runtimes changes, run build validation immediately and treat unrelated test-environment failures as a separate track instead of conflating them with feature-scope changes.

## 2026-02-26

- When changing editor mode UX, update both the control component (toolbar UI) and the canonical default in `documentStore` so startup/reset behaviour matches the visible toggle state.
- If a PrimeVue control swap affects unit tests (for example button -> toggle switch), update shared PrimeVue stubs at the same time to keep component tests aligned with runtime markup.
- When the user provides a visual reference, match control geometry and colour first, then mirror label placement exactly (for example moving the mode label to the opposite side) before further refinements.
- For cross-editor cursor sync, avoid ad-hoc text-node traversal that drops block separators; use ProseMirror `textBetween(..., "\n", "\n")` consistently for both full text and position mapping so plain-text offsets remain stable across paragraphs.
- For cross-editor scroll sync, do not assume the editor root is the real scroll container; resolve and observe the active scrollable element (`.milkdown`, `.editor`, `.ProseMirror`, or root) and retry restore over multiple animation frames until the layout settles.
- For editor remount flows, apply focus with `preventScroll` (or focus before restoring viewport) because default focus behaviour can override restored scroll and snap back to the start.
- When sync behaviour remains ambiguous after two fixes, add structured debug logs in both adapters and the central coordinator with stable tags so capture-vs-restore mismatches can be diagnosed from one reproduction trace.
- Never publish viewport snapshots from `onUnmounted` when DOM may already be detached; this can overwrite valid scroll data with zero and poison the next restore. Prefer preserving last known metrics captured during active scroll events.
- For cursor drift debugging, keep logs compact but comparative: log both final pre-switch cursor and post-restore cursor with a short text preview window so offset deltas can be verified against nearby content.
- Guard snapshot publishing during programmatic restore. Selection/scroll events triggered by restore should not overwrite anchors, or small mapping errors compound on every mode switch.
- If token-anchor restores are stable but systematically offset, replace token-only anchoring with deterministic cross-representation mapping (plain-text <-> markdown boundary map) and use snapshot recency to choose which mode owns the truth at switch time.
- Composables with module-level shared refs (for example `useSidebarResize`) can leak state between tests; reset via controlled mount/setup paths rather than assuming a clean instance per test.
- For Tauri-runtime composables under Vitest, prefer mocking runtime ports/listeners and stubbing `console.error` in targeted tests to avoid noise from expected no-op `invoke` paths.
- For drag-and-drop UI features, always add temporary structured logs at both UI-event and store-mutation layers before iterating on fixes; this quickly separates "events not firing" from "state not mutating" failures.
- In desktop webviews, native HTML5 drag events can emit `dragstart/dragend` without reliable `dragover` on sibling tabs; prefer pointer-tracked reorder (`mousedown/mousemove/mouseup` + `elementFromPoint`) for robust tab dragging.
