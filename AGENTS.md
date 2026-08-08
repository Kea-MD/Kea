# AGENTS.md

Agent-facing guidance for working in this repository.

## Project Snapshot

- App type: Tauri v2 desktop app with React 19 + Vite frontend and Rust backend; legacy Vue modules remain during migration.
- Frontend state: React state in `src/`; legacy Pinia stores remain in `legacy/src/modules/*/state/`.
- Editor stack: React owns the default shell with CodeMirror source editing plus Milkdown rendered editing during the current migration; the planned direction is a single CodeMirror-backed Markdown surface with rich widgets.
- Legacy UI kit: PrimeVue (Aura theme) + custom CSS variables in `legacy/src/styles/global.css`.
- Package manager: npm (`package-lock.json` is committed).
- Language policy: use NZ English for user-facing copy (for example, "Minimise").

## Rule Files Check (Cursor / Copilot)

- `.cursor/rules/`: not present.
- `.cursorrules`: not present.
- `.github/copilot-instructions.md`: not present.
- Therefore, this `AGENTS.md` is the primary agent instruction file in-repo.

## Build, Run, Lint, and Test Commands

## Node / Frontend Commands

- Install deps: `npm install`
- Dev server only: `npm run dev`
  - Runs the default React app on port `1420` (strict port in `vite.config.ts`).
- Legacy Vue dev server: `npm run dev:legacy`
  - Uses `legacy/vite.config.ts`.
- Type-check + production web build: `npm run build`
  - Runs `tsc --noEmit && vite build` for the default React app.
- Build the legacy Vue app: `npm run build:legacy`
  - Runs `vue-tsc` against `tsconfig.legacy.json` and builds from `legacy/`.
- Run frontend unit tests once: `npm run test:unit`
- Run frontend unit tests with coverage: `npm run test:unit:coverage`
- Run frontend unit tests in watch mode: `npm run test:unit:watch`
- Preview built web app: `npm run preview`

## Tauri Commands

- Tauri CLI passthrough: `npm run tauri -- <args>`
- Run desktop app in dev: `npm run tauri dev`
- Build desktop app: `npm run tauri build`

## Rust Commands (from repo root)

- Build Rust crate directly: `cargo build --manifest-path src-tauri/Cargo.toml`
- Run Rust tests: `cargo test --manifest-path src-tauri/Cargo.toml`
- Run a single Rust test (exact):
  - `cargo test --manifest-path src-tauri/Cargo.toml test_name -- --exact --nocapture`
- Run Rust clippy (if needed):
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

## Lint / Test Reality (Important)

- No dedicated JS/TS lint script is configured in `package.json`.
- JS/TS unit tests are run with Vitest (`vitest.config.ts`, `tests/**/*.test.ts`).
- Coverage uses Vitest v8 provider with minimum thresholds configured in `vitest.config.ts`.
- Treat `npm run build` + `npm run test:unit` as the minimum CI-style validation for frontend changes.
- For backend behaviour checks, rely on targeted Rust tests when present.

## Single-Test Guidance

- Frontend: run a single test file with `npm run test:unit -- tests/path/to/file.test.ts`.
- Frontend coverage for a single test file: `npm run test:unit:coverage -- tests/path/to/file.test.ts`.
- Rust: use `cargo test ... test_name -- --exact` as shown above.
- If test structure/scripts change in future, also update this file.

## Architecture and File Ownership

- Frontend entry: `index.html` → `src/main.tsx`.
- Legacy entry: `legacy/index.html` → `legacy/src/main.ts`.
- Default Vite config: `vite.config.ts` (React); legacy Vue config: `legacy/vite.config.ts`.
- Main app shell: `src/App.tsx`.
- Shared contracts: `src/core/`.
- Runtime adapters: `src/adapters/` and `src/platform/`.
- Framework-neutral editor/shortcut helpers: `src/modules/`.
- Legacy app runtime/UI: `legacy/src/app/`, `legacy/src/modules/`, and `legacy/src/shared/`.
- Tauri command surface: `src-tauri/src/commands/file.rs`.
- Tauri bootstrap/menu setup: `src-tauri/src/lib.rs`.

## Legacy Vue + TypeScript Conventions

- Use Vue 3 Composition API with `<script setup lang="ts">` for SFCs.
- Keep SFC block order: `<script setup>`, `<template>`, `<style scoped>`.
- Prefer strongly typed refs/computed values when types are not obvious.
- Use interfaces/types for structured payloads (store entities, invoke responses, props).
- Prefer explicit return types on exported functions/composables where useful.
- Do not use `any` unless unavoidable; narrow unknown values with guards.

## Import Conventions

- Group imports in this order:
  1) framework/external packages (`vue`, `pinia`, `@tauri-apps/*`, etc.)
  2) internal modules/components/composables/stores
  3) styles/assets
- Keep import paths consistent with nearby files (mostly relative imports in `src/`).
- In large edits, avoid import churn that is unrelated to the task.

## Formatting Conventions

- Use 2-space indentation in TS/Vue/CSS.
- In most Vue/TS source files under `legacy/src/`, style is single quotes and no semicolons.
- Some config/entry files currently use double quotes and semicolons.
- Follow the dominant style of the file you edit instead of reformatting whole files.
- Keep lines readable; avoid dense one-liners for complex logic.

## Naming Conventions

- Components: PascalCase (for example `EditorToolbar.vue`, `QuickSwitcher.vue`).
- Variables/functions/composables/stores: camelCase.
- CSS classes: kebab-case.
- Store IDs: lowercase strings (for example `'document'`, `'workspace'`).
- Keep Tauri command names snake_case to match existing invoke usage.

## Error Handling Guidelines

- Frontend:
  - Wrap async Tauri calls in `try/catch` in stores/composables.
  - Log actionable errors with context (`console.error('Failed to X:', error)`).
  - Re-throw when caller needs to decide UX; otherwise return safe fallbacks.
  - Respect existing sentinel handling (for example `'No file selected'`).
- Rust commands:
  - Return `Result<_, String>` and map OS/IO errors into clear messages.
  - Validate paths/inputs before mutating filesystem state.
  - Preserve existing behaviour for user-cancelled dialogs.

## State and Data Flow Guidelines

- Put cross-component app state in Pinia stores, not ad-hoc globals.
- Keep UI-only ephemeral state local to components/composables.
- For document lifecycle changes, prefer adding actions in `documentStore`.
- For file tree/workspace operations, prefer `workspaceStore` + Tauri commands.

## Styling and Theme Guidelines

- Reuse CSS custom properties from `legacy/src/styles/global.css` when working on the legacy UI; React styles live in `src/styles.css`.
- Dark mode is class-based (`.dark`), configured via PrimeVue `darkModeSelector`.
- Prefer extending design tokens over hardcoded colours.
- Preserve existing visual language unless asked for a redesign.

## Rust / Tauri Guidelines

- Keep command registration centralized in `src-tauri/src/lib.rs`.
- Keep filesystem command logic in `src-tauri/src/commands/file.rs` unless refactoring.
- Use standard Rust formatting and idioms (`cargo fmt` compatible).
- Avoid panics in command paths; return structured errors instead.

## Agent Workflow Expectations

- Make minimal, targeted changes; avoid broad refactors unless requested.
- Do not add new dependencies unless necessary and justified.
- Do not invent scripts/config that do not exist; document gaps clearly.
- When touching both frontend and Rust, verify both sides build.

## Suggested Verification Checklist

- Frontend-only change:
  - `npm run build`
  - `npm run test:unit`
  - `npm run test:unit:coverage`
- Tauri/Rust command change:
  - `cargo test --manifest-path src-tauri/Cargo.toml`
  - `npm run tauri build` (or at least `npm run build` + `cargo build --manifest-path ...`)
- Behavioural UI change:
  - run `npm run tauri dev` and sanity-check the impacted flow manually.

## Keep This File Updated

- Update this file when commands/scripts/tooling change.
- Update this file when lint/test frameworks are introduced.
- If Cursor/Copilot rule files are later added, mirror their key constraints here.
