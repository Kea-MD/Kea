# Kea Post-Migration TODO

Last updated: 2026-02-24

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
