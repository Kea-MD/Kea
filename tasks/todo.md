# Kea Post-Migration TODO

Last updated: 2026-02-27

## Current Task: Scrollable editor tab bar overflow

- [x] Audit `EditorTabs.vue` structure/styles to identify safest overflow scroll strategy
- [x] Implement horizontal scrolling behaviour for crowded tab sets while preserving drag/reorder
- [x] Run focused validation (`npm run test:unit -- tests/unit/editor-tabs.test.ts` and `npm run build`)
- [x] Document implementation notes in review section

## Current Task: Tab strip edge-fade gradients on scroll

- [x] Add overflow state tracking for left/right tab-strip edges
- [x] Add gradient fade affordances that appear only when hidden tabs exist off-screen
- [x] Keep drag/reorder and wheel-scroll behaviour intact with focused tests
- [x] Run focused validation (`npm run test:unit -- tests/unit/editor-tabs.test.ts` and `npm run build`)

## Current Task: Runtime/platform context centralisation

- [x] Add shared runtime helpers for Tauri, web, macOS, and mobile viewport checks
- [x] Add reusable `useRuntimeContext` composable with fullscreen + mobile + traffic-light inset state
- [x] Migrate duplicated platform checks in app bootstrap, external file sync, settings shortcuts, and empty state UI
- [x] Gate tab-bar 90px inset behind runtime context (`tauri + macOS + not fullscreen + not mobile + sidebar closed`)
- [x] Run focused unit tests + `npm run build`

## Current Task: Edge glow startup mask geometry fix

- [x] Trace edge-glow geometry/mask initialisation path on app startup
- [x] Implement a robust geometry resync strategy for startup/layout-settle timing
- [x] Validate with `npm run build`
- [x] Document root cause and verification notes in review section

## Current Task: Tab drag/reorder diagnostics

- [x] Add structured debug logging for tab drag lifecycle in `EditorTabs.vue`
- [x] Add structured debug logging for `documentStore.reorderTabs` requests/results
- [x] Reproduce drag in app and capture one full log trace (`dragstart -> dragover -> reorder -> dragend`)
- [x] Replace native HTML5 drag handling with pointer-based drag tracking for tab reorder reliability in desktop webview
- [x] Re-run focused unit tests and `npm run build`

## Current Task: Cross-editor cursor + scroll sync

- [x] Add a central viewport sync coordinator for source/rendered modes
- [x] Wire CodeMirror to publish and restore cursor/scroll snapshots
- [x] Wire Milkdown to publish and restore cursor/scroll snapshots
- [x] Run `npm run build`
- [ ] Manually verify mode switching parity in app (`source <-> rendered`) across long documents

## Current Task: Test-suite hardening sprint (strong coverage)

- [x] Add missing unit tests for runtime/composable modules (`useEditorAppActions`, `useEditorUiState`, `useSidebarInteraction`, `useSidebarResize`, `useAutoSave`, `useExternalFileSync`)
- [x] Add missing unit tests for key UI modules (`QuickOpenDialog`, `SettingsDialog`, `ExternalChangeBanner`, `EditorEmptyState`)
- [x] Add missing unit tests for shared/editor plumbing (`editorCommands`, `reconcilePipeline`, Tauri `fileWatch` port)
- [x] Replace weak assertions and tautology tests with behavioural assertions
- [x] Raise and enforce stronger Vitest coverage thresholds
- [x] Add Rust unit tests for filesystem command helpers in `src-tauri/src/commands/file.rs`
- [x] Run `npm run test:unit`, `npm run test:unit:coverage`, `npm run build`, and `cargo test --manifest-path src-tauri/Cargo.toml`

## Current Task: Editor reset to blank canvas (pre-Crepe)

- [x] Remove current CodeMirror/rendered-preview runtime from editor surface
- [x] Delete obsolete runtime modules tied to the old editor implementation
- [x] Replace open-file editor area with a neutral blank-canvas placeholder
- [x] Run `npm run build`
- [ ] Resolve/confirm Vitest environment issue (`localStorage.* is not a function`) before relying on unit-test results for this branch

## Current Task: Replace rendered view with Milkdown Crepe (phase 1)

- [ ] Finalise migration design: dual-runtime strategy (CodeMirror for source mode, Crepe for rendered mode) and command-routing contract
- [ ] Add Milkdown dependencies (`@milkdown/crepe`, `@milkdown/kit`) and align Vue version to a Crepe-compatible release
- [ ] Replace CodeMirror rendered extension path by removing `renderedPreviewExtension.ts` usage from runtime
- [ ] Implement Crepe runtime module with lifecycle hooks (create/destroy/switch file/switch mode)
- [ ] Keep `documentStore` as canonical state; add debounced markdown sync from Crepe -> store and safe store -> Crepe reloads
- [ ] Route toolbar/menu commands to active engine (CodeMirror in source mode, Crepe in rendered mode)
- [ ] Preserve global shortcuts and menu actions (open/save/new/find/undo/redo) with mode-aware behaviour
- [ ] Update `EditorSurface.vue` host layout/styles for separate source and rendered mounts
- [ ] Add/update unit tests for editor mode switching, command dispatch, and store sync invariants
- [ ] Remove obsolete rendered-mode code paths and stale docs references that no longer describe runtime behaviour
- [ ] Run `npm run build`, `npm run test:unit`, and targeted manual smoke checks (open/edit/save/switch/undo/redo/find)

### Migration Acceptance Criteria

- [ ] Switching Source <-> Rendered never loses content or cursor catastrophically
- [ ] Rendered mode is directly editable (Obsidian-style) using Crepe, not static preview widgets
- [ ] External file change reconciliation still behaves correctly in both modes
- [ ] Toolbar and menu commands remain predictable; unsupported actions are explicitly handled
- [ ] No regressions in file open/save/new tab workflows or autosave behaviour

## Current Task: Workspace restore false-positive fix

- [x] Fix `restoreWorkspace` so it treats directory-read failures as failures instead of empty-success restores
- [x] Add/update unit tests to cover failed restore path with real read-directory rejection
- [x] Run `npm run test:unit` and `npm run build`

## Current Task: Unit testing expansion (90% coverage push)

- [x] Add branch-focused store tests for move/refresh/save/error edge paths in `workspaceStore` and `documentStore`
- [x] Add additional behavioural tests for `FileTree` and `FileTreeItem` drag/rename/input-guard branches
- [x] Add direct Tauri adapter contract tests for `workspaceFs` and `documentStorage` invoke signatures
- [x] Run `npm run test:unit`, `npm run test:unit:coverage`, and `npm run build`

## Current Task: Unit testing expansion (document store edge-case coverage)

- [x] Add edge-case unit tests for `documentStore` close/save/open flows and sentinel handling
- [x] Add external-change edge tests for clean-doc apply, ignored snapshot handling, and missing-file behaviour
- [x] Run `npm run test:unit`, `npm run test:unit:coverage`, and `npm run build`

## Current Task: Unit testing expansion (FileTree drag/drop + lifecycle coverage)

- [x] Add drag/drop unit tests for `FileTree` pointer movement threshold and valid folder drop behaviour
- [x] Add menu/lifecycle tests for `FileTree` outside-click close, rename close, and unmount listener cleanup
- [x] Run `npm run test:unit`, `npm run test:unit:coverage`, and `npm run build`

## Current Task: Unit testing expansion (FileTree behaviour coverage)

- [x] Add behavioural unit tests for `FileTree` context-menu create/delete flows
- [x] Add behavioural unit tests for `FileTree` mount restore and open-file error handling
- [x] Run `npm run test:unit`, `npm run test:unit:coverage`, and `npm run build`

## Current Task: Unit testing expansion (Tauri-port action coverage)

- [x] Add action-focused unit tests for `workspaceStore` with mocked `tauriWorkspacePort`
- [x] Add action-focused unit tests for `documentStore` with mocked `tauriDocumentStoragePort`
- [x] Run `npm run test:unit`, `npm run test:unit:coverage`, and `npm run build`

## Current Task: Unit testing expansion (FileTreeItem + theme/composable coverage)

- [x] Add unit tests for `FileTreeItem` interaction and rename flows
- [x] Add unit tests for `useTheme` initialisation/toggle/system-change behaviour
- [x] Add dispatch pipeline tests for `dispatchDocumentCommand`
- [x] Run `npm run test:unit`, `npm run test:unit:coverage`, and `npm run build`

## Current Task: Unit testing expansion (stores + editor tabs)

- [x] Add store unit tests for settings, document, and workspace state logic
- [x] Add editor tabs component unit tests for tab selection/creation/close behaviour
- [x] Run `npm run test:unit`, `npm run test:unit:coverage`, and `npm run build`

## Current Task: Unit testing expansion (CI + component tests + coverage)

- [x] Add GitHub Actions frontend CI workflow running unit tests, coverage, and build
- [x] Add component-level unit tests for toolbar and file tree actions
- [x] Add Vitest coverage command/reporting with baseline enforced thresholds
- [x] Run `npm run test:unit`, `npm run test:unit:coverage`, and `npm run build`

## Current Task: Unit testing foundation (site-wide button hover hints)

- [x] Add a frontend unit test framework (Vitest + Vue support) with npm scripts
- [x] Add a first automated guard test to enforce hover hint attributes on all Vue buttons
- [x] Update agent guidance to reflect new JS/TS test capability and commands
- [x] Run `npm run test:unit` and `npm run build`

## Current Task: Brand colour consistency pass

- [x] Audit non-monochrome app UI colours in `src/app` and `src/modules`
- [x] Add complete brand tokens in `src/styles/global.css` (`--tt-brand-color-rgb`, `--tt-brand-color-500`)
- [x] Replace legacy non-brand accent fallbacks/literals in workspace and quick open UI
- [x] Align external-change banner styling with brand token usage in `src/app/EditorApp.vue`
- [x] Run `npm run build`

## Current Task: Settings modal + menu entry

- [x] Add extensible settings state in `src/modules/settings/state/settingsStore.ts`
- [x] Add in-app Settings modal UI with theme and startup controls
- [x] Wire Settings open/close from sidebar button and native menu (`Cmd/Ctrl+,`)
- [x] Apply startup restore toggle to workspace auto-restore flow
- [x] Run `npm run build` and `cargo test --manifest-path src-tauri/Cargo.toml`

## Current Task: Markdown rendered theme folder support

- [x] Move markdown theme source to `src/styles/themes/` for now
- [x] Wire rendered-mode runtime to load the in-repo `whitey.css` theme
- [x] Keep rendered theme application scoped and dark/light aware
- [x] Run `npm run build` and `cargo test --manifest-path src-tauri/Cargo.toml`

## Current Task: Rendered view visual polish (Notion-like)

- [x] Review current rendered-mode styling and identify high-impact visual gaps
- [x] Refine typography, spacing, and markdown element styling in `src/modules/editor/ui/EditorSurface.vue`
- [x] Run `npm run build` and capture notes in review section

## Current Task: Rendered Markdown modularisation (Marked.js)

- [x] Replace block-by-block rendered-mode architecture with one document-level rendered widget
- [x] Reduce markdown pipeline to core `marked` + `dompurify` only
- [x] Remove custom markdown extensions and cross-block context stitching logic
- [x] Remove image/path rewriting and other platform-specific render-side complexity
- [x] Trim editor view styles to a minimal baseline and keep only essential markdown presentation
- [x] Run `npm run build` and capture simplification notes in review section

## Current Task: Src architecture modularisation

- [x] Move editor domain code to `src/modules/editor` (`ui/`, `runtime/`, `state/`, `markdown/`)
- [x] Move workspace domain code to `src/modules/workspace` (`ui/`, `runtime/`, `state/`)
- [x] Move Tauri adapters/contracts to `src/platform/tauri`
- [x] Move app shell/entry to `src/app` and keep `src/main.ts` as thin bootstrap
- [x] Move shared cross-domain utilities to `src/shared`
- [x] Run `npm run build` after import rewrites and path migration

## Current Task: Rendered View (Obsidian-style)

- [x] Replace `hybrid` naming with `rendered` in mode state and UI labels
- [x] Add Source/Rendered mode toggle controls in toolbar and menu
- [x] Implement CodeMirror rendered-mode block widgets with click-to-edit behaviour
- [x] Hide line numbers in rendered mode and preserve them in source mode
- [x] Add markdown rendering pipeline (`remark-rehype`, `rehype-stringify`, `rehype-sanitize`)
- [x] Run `npm run build` and verify no regressions in core editor commands

## Goal

Ship a stable v0.1 post-migration build with strong local editing, external sync safety, and a reliable collaboration baseline.

## Phase A: Stabilise Core Editing (P0)

- [ ] Run full manual smoke pass for open/edit/save/switch/close/new using `docs/plans/2026-02-18-p0-parity-checklist.md`
- [ ] Verify source mode and hybrid mode behaviour across short/long markdown files
- [ ] Fix editor command edge cases (multi-line selection transforms, list toggles, heading transforms)
- [ ] Harden smart paste and auto-pairs in `src/components/editor/CustomEditor.vue`
- [ ] Ensure keyboard-first flow works for all P0 commands (menu + shortcuts + toolbar)

## Phase B: External Change Safety (P0)

- [ ] Validate watcher lifecycle (start/stop/switch file/close tab/close app)
- [ ] Validate conflict banner behaviour under repeated external edits
- [ ] Add small regression tests for `applyExternalEdit` paths in store/core logic
- [ ] Confirm no noisy logs for expected file-missing or watcher-stop scenarios

## Phase C: Collaboration Hardening (P0 baseline)

- [ ] Deferred: redesign collaboration architecture and reintroduce once network transport and UX are production-ready

## Phase D: Codebase Cleanup and Docs

- [ ] Remove/modernise stale references in `README.md` and docs that still mention TipTap workflow
- [ ] Add concise architecture notes for command bus + ports + sync adapters
- [ ] Prune obsolete CSS/classes/assets no longer needed after editor migration
- [ ] Add follow-up ADR/task note for upgrading from broadcast adapter to networked provider

## Verification Backlog

- [x] `npm run build`
- [x] `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] `npm run tauri -- dev --no-watch --no-dev-server --config '{"build":{"beforeDevCommand":null}}'` startup smoke
- [ ] Manual P0 acceptance pass recorded in `tasks/todo.md` review notes

## Review Notes

- [x] Runtime/platform detection is now centralised in `src/shared/platform/runtime.ts` and `src/shared/composables/useRuntimeContext.ts`; tab-bar traffic-light inset now responds to Tauri/mac/fullscreen/mobile state instead of static CSS.
- [x] Brand colour consistency pass completed: removed legacy purple accent fallbacks, added canonical brand tokens, and aligned non-monochrome app accents to brand-driven styling across app/workspace surfaces.
- [x] Previous migration checklist completed.
- [ ] Post-migration hardening pass started.
- [x] Temporary Yjs/BroadcastChannel collaboration implementation removed; collaboration is intentionally deferred.
- [x] Hybrid preview/outline side panel removed for now; editor is source-first only.
- [x] `editorMode` state in `documentStore` is intentionally kept (currently unused in UI) so preview/outline can be reintroduced later without reshaping store contracts.
- [x] CodeMirror 6 editor foundation landed in `CustomEditor.vue` with native search panel, history, line numbers, markdown mode, and close-brackets.
- [x] Toolbar/menu command path now runs through a shared CodeMirror command registry in `src/components/editor/codemirror/commandRegistry.ts`.
- [x] Rendered view now mirrors Obsidian-style live preview with block widgets and click-to-edit in `src/components/editor/codemirror/renderedMarkdownMode.ts`.
- [x] Rendered view refinements landed: task-list checkbox toggling, improved click-to-cursor mapping, and Escape blur to re-enter full rendered state.
- [x] `test.md` compatibility pass added cross-block definitions/footnotes context, HTML block handling (`<details>`, `<kbd>`, `<sub>`, `<sup>`), and active block style parity in rendered edit mode.
- [x] Extended `test.md` compatibility now covers highlight syntax (`==...==`), definition lists, callout blockquotes (`[!NOTE]`/`[!WARNING]`), and heading slug anchors for TOC links.
- [x] Rendered mode now resolves relative image paths against the active markdown document path (including HTML `<img>` usage with width attributes).
- [x] Rendered markdown mode now uses a modular Marked.js pipeline (`src/components/editor/codemirror/markdown/`) with DOMPurify sanitisation and extension-based features (headings, callouts, footnotes, highlights, definition lists).
- [x] Rendered block offsets now come from `marked-token-position` instead of source text search; rendered-mode decorations now rebuild in one field instead of two parallel fields.
- [x] CodeMirror runtime orchestration moved to `src/composables/useCodeMirrorEditor.ts`, reducing `CustomEditor.vue` script surface to store + composable wiring.
- [x] Custom markdown extensions for highlight/definition-lists were removed and rendered-mode active-block decoration styles were dropped in favour of a simpler baseline path.
- [x] Rendered-mode click targeting now jumps to the block start instead of line/column approximation; this trims editor interaction complexity while preserving click-to-edit.
- [x] Rendered-mode architecture was rebuilt around a single preview widget (document-level) that only appears when editor focus is lost; focus returns plain source editing.
- [x] Markdown rendering stack now uses core `marked` + `dompurify` only; extension packages (`marked-alert`, `marked-footnote`, `marked-gfm-heading-id`, `marked-token-position`) were removed.
- [x] Relative image source rewriting and task-checkbox interactive toggles in rendered preview were intentionally removed to shrink logic and failure surface.
- [x] Source tree now follows module-first layout: editor/workspace code moved from legacy `components/`, `composables/`, `stores/`, `utils/`, `core/`, and `adapters/` paths into `src/modules/*`, `src/platform/*`, `src/shared/*`, and `src/app/*`.
- [x] Rendered preview visual polish pass completed: tighter Notion-like typography scale, centred reading width, cleaner spacing, calmer blockquote/table/code styling, and mobile-friendly padding in `src/modules/editor/ui/EditorSurface.vue`.
- [x] Rendered preview now applies a scoped theme CSS layer in a shadow-root container with safe default fallback styles.
- [x] `whitey.css` theme now lives in-repo at `src/styles/themes/whitey.css` and includes dark/light mode-aware overrides.
- [x] Dark mode application for rendered themes now uses explicit host class toggling (`is-dark`) from runtime observation of `html.dark`, avoiding unreliable `:host-context` behaviour in webview environments.
- [x] Reduced large side gutters by overriding `#write` layout in `src/styles/themes/whitey.css` to full-width content with smaller horizontal padding.
- [x] Removed all renderer fallback styling so rendered markdown styling now comes only from the active theme CSS.
- [x] Made theme loading resilient to missing files by replacing hardcoded `whitey.css` import with a glob lookup of `src/styles/themes/*.css` (no theme file now means no styling, not a Vite crash).
- [x] Removed remaining rendered-mode host/container style overrides from `src/modules/editor/ui/EditorSurface.vue` so empty theme means no custom rendered styling.
- [x] Removed final `.is-rendered-mode` container overrides (`cm-content` padding and gutter display) to ensure no app-authored rendered styling remains when no theme file exists.
- [x] Restored full `whitey.css` theme in `src/styles/themes/whitey.css` and updated rendered preview wrapper structure to include Typora-like `typora-export` and `typora-export-content` containers for better style parity with `test.html`.
- [x] Added dark-mode compatibility improvements for multi-theme setups: GitHub theme dark overrides, dark class propagation onto Typora wrappers, and `:root` selector normalisation in renderer.
- [x] Removed hardcoded dark document background in `src/styles/themes/github.css` (`#write` now transparent) so rendered content uses app surface background.
- [x] Added a dedicated settings module with versioned persistence (`kea-settings`) and a modal UI with Appearance and Workspace sections.
- [x] Wired settings open flow from sidebar button and native menu event (`open_settings`, `Cmd/Ctrl+,`).
- [x] Applied startup preference to workspace restore so launch restore is user-controlled.
- [x] Added a Vitest-based frontend unit testing foundation (`vitest.config.ts`, `npm run test:unit`) with a site-wide guard test enforcing `title`/`:title` hover hints on all Vue `<button>` and `<Button>` tags.
- [x] Expanded testing to include GitHub Actions frontend CI, component tests for `EditorToolbar`/`FileTree`, and Vitest coverage reporting with baseline thresholds.
- [x] Added further unit test coverage for `settingsStore`, `documentStore`, `workspaceStore`, and `EditorTabs` interactions, bringing frontend unit coverage to ~27% statements / ~42% functions.
- [x] Added tests for `FileTreeItem`, `useTheme`, and `dispatchDocumentCommand`, increasing frontend unit coverage to ~34% statements / ~47% functions and notably raising `FileTreeItem.vue` to ~74% line coverage.
- [x] Added mocked-port action tests for `workspaceStore` and `documentStore`, increasing frontend unit coverage to ~52% statements / ~58% functions and boosting `workspaceStore.ts` to ~64% line coverage.
- [x] Added `FileTree` behavioural tests (context menu create/delete + restore/error paths), increasing overall frontend unit coverage to ~58% statements / ~65% functions and lifting `FileTree.vue` to ~34% line coverage.
- [x] Added `FileTree` drag/drop and lifecycle tests (valid drop path, movement threshold guard, non-left drag ignore, outside-click/rename menu closure, unmount listener cleanup), raising frontend unit coverage to ~68% statements / ~72% functions and lifting `FileTree.vue` to ~77% line coverage.
- [x] Added `documentStore` edge-case tests (confirm cancel paths, `saveAllFiles` partial failure, open dialog sentinel handling, external-change guards, save-as error state reset, tab cycling), raising frontend unit coverage to ~72% statements / ~75% functions and lifting `documentStore.ts` to ~72% line coverage.
- [x] Expanded tests across state, UI drag/drop, and platform adapters to reach ~90.27% statement coverage (`102` tests across `16` files), with all validation commands passing.
- [x] Completed a second hardening pass: expanded to `163` passing frontend tests across `29` files with coverage at `93.27%` statements / `85.48%` branches / `95.52%` functions / `94.25%` lines, tightened enforced coverage thresholds to `90/90/90/85` (lines/functions/statements/branches), deepened shortcut/dialog/quick-open/composable branch coverage, and kept all validation commands green.
- [x] Edge glow startup mask issue traced to geometry/cutout sync running before layout was fully settled (or before `.pageContainer` was reliably measurable), with no guaranteed follow-up sync; fixed by adding startup frame resyncs plus `ResizeObserver`-driven geometry updates so mask size/position self-corrects deterministically after mount.
- [x] Editor tab overflow now scrolls horizontally via a dedicated `.tabs-scroll` viewport in `EditorTabs.vue`, keeping the new-tab action visible and preserving pointer drag/reorder behaviour.
- [x] Added left/right gradient edge fades for the tab strip in `EditorTabs.vue`, driven by live overflow state (`scrollLeft`, `clientWidth`, `scrollWidth`) with resize + scroll updates so fades appear only when there are hidden tabs off-screen.
- [x] Fixed dark-mode tab-strip fade colour mismatch by introducing explicit fade-colour tokens in `EditorTabs.vue` (`--tt-gray-light-50` / `--tt-gray-dark-100`) instead of a light-only semantic token.
- [x] Updated tab-strip edge treatment to fade content to transparent via CSS masking (`mask-image` / `-webkit-mask-image`) rather than drawing colour overlays, so transparent backgrounds render correctly in both light and dark themes.
- [x] Improved tab-strip scroll feel by remapping only pure vertical wheel deltas (mouse wheel path) and leaving horizontal/mixed trackpad deltas to native scroll handling to avoid sticky scroll behaviour.
- [x] Replaced CSS `@property`-based mask transitions with JS-driven RAF interpolation for tab edge-mask values so fade-in/out animation is smooth and reliable in the Tauri webview.
- [x] Restored new-tab button placement inside the tab flow (`tabs-list`) so it sits beside the last tab and appears on the left when there are no open tabs, matching previous behaviour expectations.
- [x] Prevented active tab edge clipping in the scrollable strip by adding conditional horizontal padding to `tabs-list` when tabs exist, preserving overhanging active-tab corners at both ends.
- [x] Corrected `tabs-list` padding scope so edge-preserving padding only applies when tabs exist (`.tabs-scroll-wrap.has-tabs .tabs-list`), keeping the no-tabs new-button position flush left.
