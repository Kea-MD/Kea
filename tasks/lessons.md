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
