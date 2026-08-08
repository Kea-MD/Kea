# React Migration

**Status:** Active
**Related plan:** `plans/writer-computer-inspired-editor-direction.md`

## Decision

Kea will migrate the frontend from Vue/Pinia to React with TypeScript/TSX and Tailwind CSS.

This is a product and workflow decision as well as a technical one: the team prefers working in TSX and Tailwind, and the target ecosystem offers mature accessible/headless component primitives suitable for Kea's editor, workspace, settings, comments, asset, and collaboration surfaces.

The migration will preserve the Tauri v2/Rust backend and retain reusable TypeScript/domain/platform contracts where practical.

## Goals

- Make React/TSX the only long-term frontend framework.
- Use Tailwind CSS and accessible component primitives for the UI foundation.
- Preserve Markdown source fidelity and local-first behaviour during migration.
- Avoid carrying Pinia's current responsibilities into a new monolithic Zustand store.
- Extract framework-neutral document, workspace, editor, metadata, assets, and runtime contracts.
- Port behaviour in vertical slices with explicit parity tests.
- Keep the migration reversible until the React shell reaches feature parity.

## Non-goals

- Do not rewrite the Tauri/Rust backend without a concrete boundary need.
- Do not translate Vue files mechanically one-for-one.
- Do not run a permanent Vue/React hybrid in production.
- Do not use React migration as a reason to defer filesystem safety, reconciliation, or accessibility.
- Do not add UI libraries without checking accessibility, bundle cost, styling control, and Tauri compatibility.

## Target stack

- React and React DOM.
- TypeScript and TSX.
- Vite with the React plugin.
- Tailwind CSS.
- A small state layer such as Zustand after framework-neutral state contracts are extracted.
- CodeMirror as the canonical editor engine.
- Existing Tauri API and Rust command surface, adapted behind typed ports.
- Vitest and a React testing library for component/integration coverage.

## Migration architecture

```text
React app shell
  -> feature controllers/hooks
      -> framework-neutral core use-cases
          -> typed ports
              -> Tauri/web adapters
```

React components may own presentation and ephemeral UI state. They must not own filesystem policy, persistence conflict resolution, or collaboration merge semantics.

## Stages

### Stage 1: Toolchain and shell spike

- Add React/Vite/Tailwind dependencies and configuration in an isolated entry or migration branch.
- Mount a minimal React shell beside the existing Vue app, then make React the default production entry once the parity gate for each migrated slice passes.
- Verify Tauri dev/build integration, CSS loading, fonts, assets, dark mode, and window layout.
- Choose the component primitive strategy before porting complex UI.

### Stage 2: Contract extraction

- Extract runtime context and capability types.
- Extract document storage, workspace filesystem, file-watch, settings, and error contracts.
- Extract editor command/capability types.
- Extract pure document operations and reconciliation types from Pinia stores.
- Add contract tests that can run without Vue or React.

### Stage 3: Vertical slices

Port in this order:

1. app shell and runtime context;
2. workspace open/restore and file tree;
3. document tabs and lifecycle;
4. CodeMirror editor and editor command controller;
5. autosave and external-change UX;
6. settings and shortcuts;
7. comments/provenance metadata surfaces;
8. assets, Mermaid, and math widgets;
9. collaboration and presence surfaces.

Each slice must include:

- React implementation;
- adapter integration;
- parity tests;
- accessibility review;
- removal/retirement plan for the old Vue path.

### Stage 4: Cutover

- Run React as the default app entry.
- Verify Tauri desktop smoke tests and manual workflows.
- Remove Vue/Pinia/Milkdown/Vue Test Utils/Vue plugin dependencies and old SFCs.
- Remove temporary migration flags and dual entry points.
- Update repository instructions and architecture docs.

## Component strategy

Prefer accessible primitives rather than a monolithic theme-bound component library. Evaluate candidates for:

- keyboard and screen-reader behaviour;
- focus management in dialogs/popovers/menus;
- Tailwind compatibility;
- controlled/uncontrolled APIs;
- styling override quality;
- bundle impact;
- SSR/webview compatibility;
- maintenance and licensing.

Keep editor widgets and file-tree interactions as Kea-owned feature components even if they use primitives for menus, dialogs, tooltips, and command palettes.

## Acceptance criteria

- React app mounts successfully in Tauri dev and production builds.
- React can use the existing typed Tauri ports without direct invoke calls from presentation components.
- Core document tests run without Vue or React dependencies.
- Workspace, tabs, editing, save, external change, settings, and shortcuts have parity coverage before cutover.
- Rich Markdown widgets preserve source ranges and degrade safely.
- Comments and provenance use companion metadata rather than changing canonical Markdown.
- The final production bundle contains one frontend framework.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Feature parity drift | Port vertical slices with explicit acceptance tests and keep the old app runnable until each slice passes. |
| State rewrite recreates the Pinia god store | Extract pure contracts/use-cases first; keep React state projections thin. |
| UI component library lock-in | Choose headless/accessibility-first primitives and wrap them behind Kea components. |
| Tauri integration regressions | Add real desktop smoke tests before cutover. |
| Bundle growth | Measure bundle size per slice and lazy-load non-critical rich widgets. |
| Lost Vue-specific behaviour | Use existing tests as parity references, then add framework-neutral integration tests. |
| Migration stalls indefinitely | Define one cutover point and retire the Vue path rather than maintaining both indefinitely. |
