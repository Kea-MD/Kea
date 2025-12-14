# Orca

> **A Markdown editor that just works—with others.**

## Vision

Orca is a lightweight, local first, collaborative peer to peer Markdown editor that brings the ease of Google Docs to plain-text workflows. Designed for writers, developers, researchers, and teams who love Markdown's simplicity but need real-time collaboration, Orca lets you create, edit, and share documents seamlessly—while staying fully local and integrating into any existing file system.

### Why Orca?

In a world of bloated word processors, Orca strips it back to essentials: **fast**, **simple**, and **focused on Markdown**. Perfect for note-taking, technical docs, reports, or team brainstorming. No distractions—just productive writing.

### Target Users

| Persona | Use Case |
|---------|----------|
| **Developers** | Documenting code, READMEs, technical specs |
| **Writers** | Drafting articles, blog posts, manuscripts |
| **Students** | Collaborative notes, research papers, group projects |
| **Researchers** | Papers with LaTeX equations, citations, collaboration |
| **Teams** | Meeting notes, wikis, shared documentation |

### Core Philosophy

1. **Simplicity over features** — Fewer features, done perfectly
2. **Zero configuration** — Open, write, share. No setup required
3. **Local-first, P2P** — Your files on your machine, sync directly with peers, no cloud storage
4. **"It just works"** — Local files, external editors, and real-time collaboration all work together
5. **Private and Secure** — Your data, you are in control, at all times.

---

## Requirements

### Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Must have for MVP launch |
| **P1** | Must have for v1.0 |
| **P2** | Should have (post-launch) |
| **P3** | Nice to have (future) |

---

### 1. Core Editor Experience

| Feature | Priority | Description |
|---------|----------|-------------|
| **WYSIWYG Markdown** | P0 | Edit in markdown source but see rendered output live. Markdown syntax fades/hides as you type—the editor IS the preview. |
| **Standard Markdown** | P0 | Full CommonMark + GFM support: headers, lists, links, images, tables, code blocks, task lists, footnotes. |
| **Syntax Highlighting** | P1 | Code blocks with language-aware syntax highlighting and optional line numbers. |
| **Math Support** | P1 | LaTeX equations inline (`$...$`) and block (`$$...$$`) via KaTeX. |
| **Diagram Support** | P2 | Mermaid.js for flowcharts, sequence diagrams, Gantt charts. |
| **Source Mode Toggle** | P1 | View raw markdown source with `Cmd+/` or toggle button. Syntax highlighting with line numbers. |

### 2. Editing Features

| Feature | Priority | Description |
|---------|----------|-------------|
| **Smart Paste** | P0 | Intelligently convert rich text (from web, Word, etc.) to clean markdown. Handle tables, formatting, images seamlessly. This should feel like magic. |
| **Auto Pairs** | P0 | Automatically complete brackets, quotes, and markdown symbols (`*`, `_`, `` ` ``, `#`). |
| **Spell Check** | P1 | Real-time spelling/grammar via browser APIs or LanguageTool. |
| **Find & Replace** | P0 | `Cmd+F` for search, `Cmd+Shift+F` for find & replace with regex support. |
| **Word Count** | P2 | Word/character count, reading time in status bar. |
| **Undo/Redo** | P0 | Full undo/redo history with `Cmd+Z` / `Cmd+Shift+Z`. |

### 3. Real-Time Collaboration (P2P)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Live Editing** | P0 | Multiple users edit simultaneously with sub-100ms sync via P2P. |
| **CRDT Sync** | P0 | Conflict-free replicated data types (Yjs) for seamless merging. Users never see conflicts. |
| **Presence Indicators** | P0 | Show who's viewing/editing with names and colored cursors. |
| **Cursor Tracking** | P1 | See collaborators' cursors and selections in real-time. |
| **Room Codes** | P0 | Generate shareable room codes to invite collaborators. No accounts required. |
| **Room Passwords** | P1 | Optional password protection for rooms (enables E2E encryption). |
| **External Editor Sync** | P0 | VS Code, vim, etc. can edit the same file—changes sync to all peers. |
| **Local Files** | P0 | Every collaborator has their own local .md file (no cloud storage). |
| **Comments** | P2 | Inline comments or threaded discussions on text selections. |
| **Contribution Tracking** | P2 | Track who added what text, distinguish typed/pasted/AI-generated. |

### 4. File Management

| Feature | Priority | Description |
|---------|----------|-------------|
| **File Browser** | P0 | Tree view sidebar for files/folders. Non-.md files shown in grey. |
| **Local File System** | P0 | Open and save files directly to local filesystem (via Tauri). |
| **Quick Switcher** | P1 | `Cmd+P` to fuzzy-search and jump to any file. |
| **Recent Files** | P1 | Track and show recently opened files. |
| **Drag & Drop** | P1 | Reorder files/folders by dragging. |
| **Native Associations** | P1 | Double-click `.md` files in Finder/Explorer opens Orca. |
| **Version History** | P2 | Visual timeline of document changes with restore capability. |
| **Workspaces** | P2 | Save and restore workspace configurations. |

### 5. Attachments & Media

| Feature | Priority | Description |
|---------|----------|-------------|
| **Image Drag & Drop** | P0 | Drop images into editor, copy to same file location. (Configurable) |
| **Relative Paths** | P0 | Image paths relative to document for portability. |
| **Image Preview** | P0 | Show images inline in the editor. |
| **Image Resize** | P2 | Resize via drag handles or markdown attributes. |
| **Cloud Image Sync** | P3 | Sync images with collaborators during sessions. |

### 6. Export & Import

| Feature | Priority | Description |
|---------|----------|-------------|
| **Open .md Files** | P0 | Load markdown files directly. |
| **Save .md Files** | P0 | Save to local filesystem as standard markdown. |
| **Copy as Markdown** | P0 | Copy selection as raw markdown to clipboard. |
| **Export to PDF** | P1 | PDF with bookmarks from headers, styled output. |
| **Export to HTML** | P2 | Rendered HTML with embedded styles. |
| **Import from PDF** | P3 | OCR/convert PDF to markdown. |

### 7. Navigation & Search

| Feature | Priority | Description |
|---------|----------|-------------|
| **Outline View** | P0 | Sidebar table of contents auto-generated from headers. Click to jump. |
| **In-Doc Search** | P0 | Highlight all matches with `Cmd+F`. |
| **File Search** | P1 | Search across all files in workspace. |
| **Full-Text Search** | P2 | Search content across all files. |

### 8. UI/UX & Theming

| Feature | Priority | Description |
|---------|----------|-------------|
| **Distraction-Free** | P0 | Minimalist UI that gets out of the way. |
| **Dark/Light Mode** | P0 | Auto-switch based on system preference, manual override available. |
| **Responsive Layout** | P0 | Works on desktop, tablet, mobile screen sizes. |
| **Paper Texture** | P2 | Optional background texture for notebook feel. |
| **Custom Themes** | P3 | Load user CSS for advanced customization. (Or other theme format) |

### 9. Platform Support

| Feature | Priority | Description |
|---------|----------|-------------|
| **macOS App** | P0 | Native app via Tauri. Feels native, not like Electron. |
| **Windows App** | P1 | Native Windows app via Tauri. |
| **Linux App** | P1 | Native Linux app via Tauri. |
| **Web App** | P0 | Full-featured web version with PWA support. |
| **iOS App** | P3 | Native mobile app (future). |
| **Android App** | P3 | Native mobile app (future). |

### 10. Offline & P2P Sync

| Feature | Priority | Description |
|---------|----------|-------------|
| **Offline-First** | P0 | Work perfectly offline. Edit local files without any connection. |
| **P2P Reconnect** | P1 | Automatically reconnect to peers when network restored. |
| **Sync Status** | P1 | Subtle indicator showing P2P state (connected, peers: N, offline). |
| **External Edit Sync** | P0 | Detect and sync changes from external editors (VS Code, etc.). |
| **Conflict UI** | P2 | Visual diff when rare conflicts need user decision. |

### 11. Keyboard Shortcuts

| Feature | Priority | Description |
|---------|----------|-------------|
| **Full Keyboard Nav** | P0 | Every action accessible via keyboard. |
| **Platform Conventions** | P0 | Use standard shortcuts (Cmd+S, Cmd+C, etc.). |
| **Shortcut Hints** | P1 | Show shortcuts in menus and tooltips. |
| **Customizable** | P3 | User-configurable keybindings. |

### 12. Accessibility

| Feature | Priority | Description |
|---------|----------|-------------|
| **Screen Reader** | P1 | Full compatibility with VoiceOver/NVDA. |
| **Keyboard Only** | P1 | All features usable without mouse. |
| **High Contrast** | P2 | Theme option for better visibility. |
| **Reduced Motion** | P2 | Respect system preference. |
| **Dictation** | P3 | Speech-to-text input. |

### 13. AI Features (Future)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Inline Suggestions** | P3 | AI writing suggestions as you type (opt-in). |
| **Summarize** | P3 | Generate summary of document or selection. |
| **Translate** | P3 | Translate content to other languages. |
| **Local AI** | P3 | Run models locally via WebLLM for privacy. |

### 14. Integrations (Future)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Git Integration** | P3 | Commit/push markdown files to repos. |
| **Plugin API** | P3 | Extension system for custom functionality. |

---

## UX Principles

### Apple-Level Polish

1. **Invisible Complexity**
   - Collaboration, sync, conflicts—all handled seamlessly
   - User never thinks about "saving" or "syncing"
   - Offline mode is automatic and invisible

2. **Keyboard-First**
   - Every action has a shortcut
   - Consistent with platform conventions
   - Power users never touch the mouse

3. **Writing Experience**
   - Markdown syntax fades as you type
   - Smart auto-complete feels natural
   - Zero friction from thought to text

4. **Collaboration UX**
   - Smooth cursor following (like Google Docs but better)
   - Beautiful, unobtrusive presence indicators
   - Share a room code—no accounts, no signup, just collaborate
   - External editors (VS Code, vim) work seamlessly alongside

5. **File Management**
   - Drag-and-drop everything
   - Quick file switcher is instant
   - Recent files always accessible
   - Workspaces remember your setup

---

## Non-Goals

Things Orca explicitly does NOT try to be (yet....):

- ❌ **Not a note-taking app** — No backlinks, graph view, PKM features (use Obsidian)
- ❌ **Not a wiki** — No complex organization or navigation (use Notion)
- ❌ **Not an IDE** — No code execution, debugging, or git integration (use VS Code)
- ❌ **Not a CMS** — No publishing, SEO, or content management (use Ghost)

**Orca is a focused writing tool.** One thing, done exceptionally well.
