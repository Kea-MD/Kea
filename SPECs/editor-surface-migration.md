# Editor Surface Migration

**Status:** Proposed
**Related plan:** `plans/writer-computer-inspired-editor-direction.md`

## Problem

Kea currently maintains two whole-document editor implementations:

- CodeMirror for source mode;
- Milkdown for rendered mode.

They have separate lifecycles, selection models, command paths, and update behaviour. The toolbar and application command path is also event-based, which makes it possible for visible commands to have no active editor consumer.

## Direction

Move toward one canonical CodeMirror-backed editor surface. Markdown remains the persisted source of truth. Rendered appearance is derived through syntax-tree decorations and widgets rather than a second document model.

This direction is inspired by Writer Computer's ProseMark approach but is a Kea implementation, not a code copy or framework migration.

## Goals

- One editor state per open document.
- One undo history and selection model.
- Editor-native commands that operate on CodeMirror `EditorState`.
- Source-preserving widgets for Mermaid, math, images/media, tables, and future rich blocks.
- Stable source ranges for comments and provenance anchors.
- External reloads that update the editor without leaving a stale rendered instance.
- Graceful fallback when a rich renderer cannot parse or load.

## Non-goals

- Do not migrate Vue or Pinia.
- Do not remove Milkdown until equivalent baseline behaviour and Markdown fixtures are covered.
- Do not make rendered output canonical.
- Do not embed comments or provenance into the `.md` file.
- Do not implement every rich widget in the initial migration slice.

## Constraints and invariants

1. `.md` text is the portable canonical document.
2. Rich widgets must map to an unambiguous source range.
3. Widget state is disposable and reconstructable from Markdown plus companion metadata.
4. Comments and provenance use versioned companion metadata.
5. Local, external, and future remote changes use the same document command/reconcile boundary.
6. A renderer failure must not prevent source editing or saving.

## Migration slices

### Slice 1: command contract

- Define `EditorCommand`, `EditorCapabilities`, and `EditorController`.
- Connect toolbar/menu/shortcut commands to the active controller.
- Add delivery tests before changing editor rendering.

### Slice 2: canonical CodeMirror lifecycle

- Mount one CodeMirror state for each open tab.
- Load content from the document store.
- Publish user changes through the document command path.
- Apply external reloads through a versioned update rather than recreating an unrelated editor instance.

### Slice 3: baseline decorations

- Headings and section markers.
- Emphasis and inline code.
- Links and images.
- Lists, task lists, blockquotes, and fenced code blocks.
- Preserve editing affordances and keyboard behaviour.

### Slice 4: rich block extension points

- Mermaid fenced blocks.
- Inline and block math.
- Image/media widgets and relative asset resolution.
- Tables and future block renderers.

Each extension must define:

```ts
interface MarkdownWidgetAdapter {
  id: string
  canRender(node: MarkdownNode): boolean
  render(node: MarkdownNode, context: WidgetContext): HTMLElement
  dispose?(element: HTMLElement): void
}
```

The exact interface may change during implementation, but adapters must not mutate canonical content behind the editor's knowledge.

### Slice 5: comments and provenance

- Define stable source-range/structural anchors.
- Define companion metadata schema and migration hooks.
- Re-anchor after local edits, external reloads, and future remote merges.
- Keep metadata optional and exportable separately.

## Acceptance criteria

- Toolbar commands execute against the active editor.
- Undo/redo operate on the same history as keyboard editing.
- Supported Markdown fixtures round-trip without unintended source changes.
- Mermaid/math/image widgets render from source ranges and fall back safely.
- External changes are visible in both editing and rendered presentations.
- Closing a tab releases editor, widget, and viewport resources.
- The editor remains usable when a renderer or metadata store fails.

## Test strategy

- Unit-test Markdown command transformations independently of Vue.
- Unit-test decoration/widget range mapping.
- Add fixture-based Markdown round-trip tests.
- Add component tests for command delivery and external reload.
- Add integration tests with an in-memory document/storage adapter.
- Add desktop smoke coverage once the Tauri E2E harness exists.
