# Kea

> **A Markdown editor that just works - with others.**

## Vision

Kea is a local-first Markdown editor with real-time collaboration. It is designed for people who want plain text files, fast writing workflows, and collaboration without handing document ownership to a cloud platform.

### Why Kea?

Kea focuses on a small set of core behaviours and does them reliably:

- Fast editing in large, real-world Markdown files
- Clean interoperability with existing folders and tools
- Real-time collaboration that degrades gracefully to local-only editing

### Target Users

| Persona | Use Case |
|---------|----------|
| **Developers** | READMEs, technical specs, project docs |
| **Writers** | Drafts, articles, long-form writing |
| **Students** | Shared notes, assignments, group projects |
| **Researchers** | Papers with citations, equations, collaborative review |
| **Teams** | Meeting notes, handbooks, internal documentation |

### Core Philosophy

1. **Simplicity over feature volume** - Fewer features, implemented well.
2. **Low setup friction** - Open, write, and share quickly; advanced settings are optional.
3. **Local-first by default** - Files live on the user's machine.
4. **Markdown is canonical** - The `.md` file is always the source of truth.
5. **Graceful collaboration** - Collaboration enhances local editing, never blocks it.
6. **Privacy by design** - Networking features are minimal, transparent, and controlled by the user.
7. **Modular architecture** - Editor, renderer, sync, and metadata layers can evolve independently.

---

## Requirements

### Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Must have for MVP |
| **P1** | Must have for v1.0 |
| **P2** | Should have post-v1 |
| **P3** | Future / exploratory |

### Release Framing

- **MVP (P0)** targets stable single-user editing plus baseline peer collaboration.
- **Runtime target** for MVP is Tauri desktop, with shared frontend architecture that can run on web.
- **P1+** closes parity gaps and adds advanced workflows.

---

### 0. Architecture & Data Model

| Feature | Priority | Description |
|---------|----------|-------------|
| **Modular Editor Architecture** | P0 | Core document logic is separated from UI/editor implementation through stable interfaces. |
| **Markdown Source of Truth** | P0 | Document content persists as plain `.md`; renderer, collaboration state, and UI state are derived layers. |
| **Cross-Runtime Core Parity** | P0 | Core workflows use shared logic and behave consistently across Tauri and web where platform APIs allow. |
| **Adapter-Based Extensibility** | P1 | Parser, renderer, collaboration provider, pagination engine, and metadata backend are swappable adapters. |
| **Companion Metadata Store** | P1 | Non-markdown metadata is stored separately (default sidecar format) with a defined schema. |
| **Schema Versioning & Migration** | P1 | Metadata schema includes explicit versioning and deterministic migration paths. |

### 1. Core Editor Experience

| Feature | Priority | Description |
|---------|----------|-------------|
| **Hybrid Markdown Editing** | P0 | Active block is editable markdown source; non-active blocks may render for readability and switch back on focus. |
| **Standard Markdown Support** | P0 | CommonMark + GFM essentials: headings, lists, links, images, tables, task lists, fenced code, footnotes. |
| **Source Mode Toggle** | P0 | Toggle full source mode with syntax highlighting and line numbers. |
| **Undo/Redo** | P0 | Reliable undo/redo for local editing operations using platform-standard shortcuts. |
| **Syntax Highlighting** | P1 | Language-aware code block highlighting, with optional line numbers. |
| **Math Support** | P1 | Inline and block LaTeX rendering (for example via KaTeX). |
| **Diagram Support** | P2 | Mermaid rendering for common diagram types. |
| **Page Layout Mode** | P1 | A paginated hybrid-mode variant with configurable page size, margins, and spacing for print/PDF workflows. |

### 2. Editing, Navigation & Search

| Feature | Priority | Description |
|---------|----------|-------------|
| **Smart Paste** | P0 | Convert rich clipboard content into clean markdown while preserving structure when possible. |
| **Auto Pairs** | P0 | Auto-complete brackets, quotes, and markdown delimiters. |
| **Find & Replace** | P0 | In-document search and replace with regex, case-sensitive, and whole-word options. |
| **Outline View** | P0 | Auto-generated heading outline with click-to-jump navigation. |
| **File Name Search** | P0 | Search files by name within the open project/workspace. |
| **Quick Switcher** | P1 | Keyboard-driven fuzzy switcher for rapid file navigation. |
| **Spell Check** | P1 | Real-time spelling support using platform/browser capabilities. |
| **Word Count** | P2 | Word/character count and reading time indicators. |

### 2.1 Markdown Tables

| Feature | Priority | Description |
|---------|----------|-------------|
| **Visual Table Editing** | P1 | Edit Markdown tables with a structured grid UI while preserving canonical markdown output. |
| **Table Context Menu** | P1 | Right-click actions for table operations: insert/delete row, insert/delete column, clear cell, and delete table. |
| **Row/Column Management** | P1 | Add, remove, and reorder rows/columns from UI controls without manual pipe alignment. |
| **Cell Management** | P1 | Edit cell content in place with multi-line support and safe escaping of markdown special characters. |
| **Header & Alignment Controls** | P1 | Toggle header row and set per-column alignment (left/centre/right) using markdown-compatible syntax. |
| **Table Formatting** | P1 | Auto-format table markdown for clean, deterministic pipe alignment after edits. |
| **Keyboard Table Navigation** | P2 | Navigate cells with keyboard shortcuts (Tab/Shift+Tab/Enter) and create rows when moving past the last cell. |
| **Cell Merge/Split (Extended Mode)** | P3 | Optional merged-cell editing via metadata/renderer extension with graceful fallback to standard markdown tables. |

### 3. Real-Time Collaboration (P2P)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Live Collaborative Editing** | P0 | Multiple peers can edit concurrently with eventual consistency and conflict-free merges. |
| **CRDT Sync Layer** | P0 | Collaboration uses CRDTs through a pluggable provider (Yjs initially). |
| **Presence & Cursor Awareness** | P0 | Show active collaborators, cursor positions, and selections in shared sessions. |
| **Room Invite Codes** | P0 | Generate short-lived codes/links to invite collaborators without accounts. |
| **Optional Room Passphrase** | P1 | Session join can require a passphrase. |
| **End-to-End Session Encryption** | P1 | Session content is encrypted end-to-end when collaboration is enabled. |
| **Optional Signalling/Relay Service** | P1 | Lightweight service may assist discovery/NAT traversal but never stores document bodies. |
| **External Editor Sync** | P0 | External changes (for example from VS Code or vim) are detected quickly and reconciled into active local/collaborative sessions with deterministic conflict handling. |
| **Comments** | P2 | Inline or threaded comments anchored to selections/ranges. |
| **Contribution Provenance** | P2 | Optional metadata tracks text origin (typed, pasted, assisted) and contributor attribution. |

### 4. Files, Projects & Workspace

| Feature | Priority | Description |
|---------|----------|-------------|
| **Local File Open/Save** | P0 | Open and save markdown directly to local filesystem using native/platform APIs. |
| **Project Open/Close/Switch** | P0 | Open existing folders as projects, close projects, and switch recent projects quickly. |
| **File Browser** | P0 | Sidebar tree view for project files and folders with clear markdown/non-markdown distinction. |
| **On-Disk Change Reflection** | P0 | If an open markdown file changes outside Kea, the editor reflects those changes reliably with clear merge/reload behaviour. |
| **Recent Files** | P1 | Track and surface recently opened files. |
| **Drag & Drop Reorder** | P1 | Reorder files/folders through drag and drop where filesystem permissions permit. |
| **Version History** | P2 | View document revision timeline and restore selected points. |
| **Workspaces** | P2 | Save and restore sets of open files, panels, and project context. |
| **Open-With Integration** | P2 | Register `.md` file handling where the host platform allows. |

### 5. Attachments & Media

| Feature | Priority | Description |
|---------|----------|-------------|
| **Image Drag & Drop** | P0 | Dropped images are copied to a configured relative assets path and referenced in markdown. |
| **Relative Asset Paths** | P0 | Media links default to relative paths for document portability. |
| **Inline Image Preview** | P0 | Show referenced images inline during editing/preview. |
| **Image Resize Controls** | P2 | Optional visual resize controls with markdown-compatible output. |
| **Session Image Transfer** | P3 | Transfer images during collaboration sessions without requiring persistent cloud storage. |

### 6. Export, Import & Printing

| Feature | Priority | Description |
|---------|----------|-------------|
| **Copy as Markdown** | P0 | Copy selected content as canonical markdown. |
| **Print Layout Consistency** | P1 | Page layout mode and printed/PDF output use the same rendering rules. |
| **Export to PDF** | P1 | Export styled PDF with heading bookmarks from document structure. |
| **Export to HTML** | P2 | Export rendered HTML with self-contained or referenced styles. |
| **Import from PDF** | P3 | Optional OCR/structure conversion from PDF to markdown. |

### 7. Platform Support

| Feature | Priority | Description |
|---------|----------|-------------|
| **Tauri Desktop Packaging** | P0 | Ship desktop builds for macOS, Windows, and Linux from the shared app codebase. |
| **Responsive Web App** | P1 | Core workflows run in modern desktop/tablet/mobile browsers with graceful degradation where APIs differ. |
| **PWA Installability** | P2 | Browser install experience with offline caching where supported. |
| **Tauri Mobile Packaging** | P3 | Mobile shell packaging for iOS and Android once desktop and web workflows are stable. |

### 8. Offline & Sync Resilience

| Feature | Priority | Description |
|---------|----------|-------------|
| **Offline-First Editing** | P0 | Editing local files requires no network connection. |
| **Local-Only Fallback** | P0 | If collaboration fails or disconnects, local editing continues without feature lockout. |
| **Peer Reconnect** | P1 | Attempt reconnection automatically when network conditions recover. |
| **Sync Status Indicator** | P1 | Show clear session state (offline, connecting, connected, peer count). |

### 9. Security, Privacy & Networking

| Feature | Priority | Description |
|---------|----------|-------------|
| **No Server-Side Content Storage** | P0 | Optional services must not persist markdown document bodies. |
| **Encrypted Transport** | P0 | Collaboration traffic uses authenticated encryption in transit. |
| **Ephemeral Discovery Metadata** | P1 | Discovery/signalling metadata is minimal and short-lived. |
| **Telemetry is Explicit Opt-In** | P1 | Diagnostics/analytics are disabled by default and clearly explained before enablement. |
| **Security Model Documentation** | P1 | Threat model, trust boundaries, and key-management approach are documented for maintainers and users. |

### 10. Keyboard Shortcuts

| Feature | Priority | Description |
|---------|----------|-------------|
| **Platform Shortcut Conventions** | P0 | Use platform-standard shortcuts for core actions (save, copy, undo, search). |
| **Full Keyboard Navigation** | P1 | Core workflows can be completed without mouse interaction. |
| **Shortcut Hints** | P1 | Menus/tooltips expose available shortcuts. |
| **Customisable Keybindings** | P3 | Users can remap selected shortcuts. |

### 11. Accessibility

| Feature | Priority | Description |
|---------|----------|-------------|
| **Accessibility Baseline (WCAG 2.2 AA)** | P1 | Meet WCAG 2.2 AA for applicable desktop/web workflows. |
| **Screen Reader Support** | P1 | Core workflows are operable with VoiceOver/NVDA class screen readers. |
| **Keyboard-Only Operation** | P1 | Core workflows remain usable without pointer input. |
| **High-Contrast Theme Option** | P2 | Provide a high-contrast mode for low-vision users. |
| **Reduced Motion Support** | P2 | Respect system reduced-motion preferences. |
| **Dictation Support** | P3 | Support speech-to-text input where platform APIs are available. |

### 12. UI/UX & Theming

| Feature | Priority | Description |
|---------|----------|-------------|
| **Distraction-Free Interface** | P0 | UI prioritises writing area and minimises non-essential chrome. |
| **Dark/Light Mode** | P0 | Follow system preference with manual override. |
| **Responsive Layout** | P1 | Layout adapts cleanly across desktop, tablet, and mobile breakpoints. |
| **Paper Texture Option** | P2 | Optional subtle background texture/theme variant. |
| **Custom Theme Support** | P3 | Advanced user theming/customisation hooks for renderer/editor styling. |

### 13. AI Features (Future)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Inline Suggestions** | P3 | Optional AI-assisted writing suggestions. |
| **Summarise** | P3 | Generate summaries for selections or full documents. |
| **Translate** | P3 | Translate content between languages. |
| **Local AI Runtime** | P3 | Optional on-device model execution for privacy-sensitive use cases. |

---

## P0 Acceptance Criteria

The MVP is considered complete only when each P0 capability has a concrete pass condition.

| Capability | Minimum Acceptance Criteria |
|------------|-----------------------------|
| **Local markdown lifecycle** | User can open, edit, and save `.md` files in an existing folder; content survives app restart with no unintended formatting loss. |
| **Canonical markdown model** | Rendering, source mode, and collaboration all round-trip through markdown text without diverging persisted output. |
| **Baseline editing workflow** | Undo/redo, smart paste, auto pairs, and find/replace work in standard documents without data corruption. |
| **Project navigation** | User can open a project folder, browse files, and switch files using sidebar and filename search. |
| **External edit reflection** | If an open file is edited in another app, Kea reflects the change without silent data loss and with explicit conflict messaging when needed. |
| **Collaboration baseline** | Two or more peers can join a room and co-edit one document with deterministic merge behaviour after concurrent edits. |
| **Offline resilience** | Editing remains fully functional with no network; collaboration failures do not block local operations. |
| **Security baseline** | No optional service persists markdown bodies; collaboration transport is encrypted. |

---

## Non-Functional Requirements

| Requirement | Priority | Target |
|-------------|----------|--------|
| **Startup time** | P0 | Cold start to editable UI within 3 seconds on a reference developer machine. |
| **Save durability** | P0 | Use atomic writes (temp file + replace) to reduce corruption risk during crashes/power loss. |
| **External file change handling** | P0 | Detect on-disk changes for open files and reflect them in the editor within 1 second in typical local conditions, with deterministic merge/reload behaviour and clear user messaging. |
| **Large document handling** | P1 | Smooth editing and navigation for at least 1 MB markdown documents and large attachments |
| **Collab latency target** | P1 | Under typical broadband conditions, local echo is immediate and remote update latency is usually below 250 ms. |
| **Memory stability** | P1 | No unbounded memory growth during multi-hour editing sessions. |

---

## UX Principles

1. **Predictable state**
   - Saving, sync, and offline states are always visible and understandable.

2. **Keyboard-first flow**
   - Core workflows are efficient from the keyboard and follow platform conventions.

3. **Low cognitive load**
   - Writing surface remains primary; secondary controls stay unobtrusive.

4. **Graceful degradation**
   - Collaboration and platform-specific features fail softly without breaking local writing.

---

## Non-Goals (Current Scope)

Things Kea does not target in MVP/v1:

- Not a personal knowledge management system (no backlinks/graph features)
- Not a wiki or CMS platform with publishing pipelines
- Not an IDE with code execution/debug tooling
- Not a general-purpose cloud storage service

Kea is a focused Markdown writing and collaboration tool.
