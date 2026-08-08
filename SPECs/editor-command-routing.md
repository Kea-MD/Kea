# Editor Command Routing

**Status:** Proposed
**Related:** `SPECs/editor-surface-migration.md`

## Problem

Editor commands currently travel through a global browser event path. The visible toolbar/menu can dispatch commands without a mounted editor consuming them.

## Decision

Introduce an explicit active-editor controller owned by the editor surface. The shell dispatches typed intents; the active editor adapter executes them and reports capabilities.

```ts
interface EditorController {
  execute(command: EditorCommand): boolean
  getCapabilities(): EditorCapabilities
  focus(): void
  destroy(): void
}
```

## Requirements

- Commands are typed and validated before reaching an adapter.
- The active editor is the only command target.
- Registration/unregistration is lifecycle-safe.
- Unsupported commands are disabled or return a structured failure; they are never silently dropped.
- Toolbar, menu, keyboard, and context-menu paths use the same command contract.
- Undo/redo use the editor's native history.
- Command execution preserves selection where the command semantics allow it.

## Initial command set

- undo, redo;
- find, replace;
- bold, italic, strikethrough, inline code;
- link, image, heading;
- bullet list, numbered list, task list, blockquote;
- fenced code block;
- insert Mermaid and math block.

## Acceptance

- Tests prove each visible command reaches the active editor.
- Tests prove commands are not delivered to an inactive/closed editor.
- Tests prove capabilities update when the active editor changes.
