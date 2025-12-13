# Orca

## Idea

### Markdown Editor, Collaborative, Simple, Powerful, and Distraction-Free

Orca is a lightweight, Markdown editor that brings the ease of Google Docs to plain-text workflows. Designed for writers, developers, researchers, and teams who love Markdown's simplicity and AI native output but would also like real-time collaboration, Orca will let you create, edit, and share documents seamlessly across web, desktop, and mobile. While also being fully local and be able to integrate into any existing local file system.

### Why Orca?

In a world of bloated word processors, Orca strips it back to essentials: fast, simple, and focused on Markdown. Perfect for note-taking, technical docs, reports, or team brainstorming. No distractions—just productive writing.

### Target Users:

Developers documenting code, writers drafting articles, students collaborating on notes and projects, or anyone tired of clunky, complex tools like Notion, Word, or Google Docs for simple text tasks.

## Requirements

### Core Markdown & Rendering

| Feature              | Priority | Comment                                                      |
| -------------------- | -------- | ------------------------------------------------------------ |
| Markdown Support     | Must     | Core: Parse/render standard Markdown (headers, lists, links, images, tables, etc.) using a library like Remark or Marked.js. Support extensions like GFM (GitHub Flavored Markdown) for tables/code. Include task lists and footnotes. |
| Math Support         | Should   | Render LaTeX equations inline using MathJax or KaTeX for formulas and numbering. |
| Diagram Support      | Could    | Render flowcharts, sequence diagrams, and Gantt charts using Mermaid.js |
| Live Preview WYSIWYG | Must     | Overlaid editor/preview. Edit in markdown source but see rendered HTML live. Libraries: React-Markdown for rendering, ProseMirror for the editable side. Hide markdown syntax for seamless editing. |
| Live Preview         | Should   | Make markdown syntax fade away as you type. The editor is the preview. |
| Syntax Highlighting  | Should   | Provide syntax highlighting for code blocks, Display line numbering. |
| Code Editing Mode    | Should   | View markdown source view by hitting a toggle or shortcut (e.g., Ctrl+/). Syntax highlighting with Prism.js or CodeMirror. Display line numbering |

### Editing Features

| Feature                    | Priority | Comment                                                      |
| -------------------------- | -------- | ------------------------------------------------------------ |
| Autocorrect                | Must     | Spelling/grammar checks. Use browser APIs or LanguageTool.js for real-time suggestions. |
| Auto Pair                  | Should   | Automatically complete brackets, quotes, and markdown symbols (e.g., \*, \_, #). |
| Smart Paste                | Must     | Intelligently convert rich text to markdown. Handle tables, formatting, images seamlessly. This is critical UX. |
| Paste as Markdown          | Must     | Smart paste that handles everything: tables, images, formatting. This should feel like magic. |
| Paste as Markdown (Import) | Should   | Convert pasted rich text to markdown.                        |
| Word Count                 | Could    | Display word/character count, reading time in sidebar.       |

### Collaboration & Sharing

| Feature                | Priority | Comment                                                      |
| ---------------------- | -------- | ------------------------------------------------------------ |
| Live Collaboration     | Must     | Real-time editing for multiple users.                        |
| Conflict Resolution    | Must     | Seamless conflict resolution. Users shouldn't think about it - it just works. |
| Presence Indicators    | Must     | Show who's viewing/editing.                                  |
| Typing Indicators      | Could    | Show collaborators cursors typing in real-time.              |
| Comments               | Could    | Inline comments or threaded discussions on selections.       |
| Share Links            | Must     | One-click sharing with permissions (view/edit).              |
| User Authentication    | Must     | Optional login/signup for collab sessions.                   |
| Track Human or Machine | Should   | Track typed/pasted/generated text                            |
| Track Contribution     | Should   | Track who added what text                                    |

### AI Features

| Feature        | Priority | Status | Comment                                                      |
| -------------- | -------- | ------ | ------------------------------------------------------------ |
| AI Integration | Should   | Todo   | Inline AI suggestions using either local model (e.g., via WebLLM) or API integration (e.g., Grok API). |

### UI/UX & Customization

| Feature                         | Priority | Comment                                                                                                                                                                                                                                |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean View                      | Must     | Minimalist distraction-free view.                                                                                                                                                                                                      |
| Light/Dark Mode                 | Must     | Auto-switch based on system theme, with manual override                                                                                                                                                                        |
| Paper Texture                   | Should   | Optional Background textures for a notebook feel.                                                                                                                                                                                      |
| Custom Editor CSS Theme Files   | Could    | Load user-provided CSS for advanced styling.                                                                                                                                                                                           |
| UI Themes and Customisation    | Could    | Customisable interface for user preferences.                                                                                                                                                                                           |

### Search & Navigation

| Feature         | Priority | Comment                                                      |
| --------------- | -------- | ------------------------------------------------------------ |
| In-Doc Search   | Must     | Highlight matches with Command+F.                            |
| Outline View    | Must     | Sidebar table of contents from headers for quick jumps.      |
| File Search     | Should   | Search across file names in the workspace.                   |
| Search and Edit | Should   | Tools for finding and replaceable and moving through content. |

### File Management

| Feature                  | Priority | Comment                                                      |
| ------------------------ | -------- | ------------------------------------------------------------ |
| File Browser             | Must     | Tree view sidebar for managing multiple files/folders. View other than .md file types in grey |
| Native File Associations | Must     | Desktop app opens .md files by default. Feels native, not like a web wrapper. |
| Version History          | Should   | Beautiful, simple version history (like Time Machine). See changes over time, restore easily. |

### Export/Import

| Feature               | Priority | Comment                                                      |
| --------------------- | -------- | ------------------------------------------------------------ |
| Export to PDF         | Must     | With bookmarks from headers.                                 |
| Import from Markdown  | Should   | Load .md files directly.                                     |
| Export to HTML        | Could    | Rendered HTML with embedded styles.                          |
| Copy as Markdown      | Must     | Clipboard copy of raw markdown.                              |
| Import from PDF       | Could    | Convert PDF to markdown using pdf.js or similar.             |
| Export/Import Options | Could    | Conversions for sharing docs. Use Pandoc.js or pdfmake for outputs. |

### Platform Support

| Feature                | Priority | Comment                                                      |
| ---------------------- | -------- | ------------------------------------------------------------ |
| Desktop Support        | Must     | Use Tauri to package web app as native desktop (Windows/Mac/Linux). |
| Web Support            | Must     | Host as a web app (PWA for offline-ish use).                 |
| Mobile Support         | Could    | iOS/Android.                                                 |
| Multi Platform Support | Must     | Ensure responsive design and progressive enhancement.        |

### Offline & Sync

| Feature            | Priority | Status | Comment                                                      |
| ------------------ | -------- | ------ | ------------------------------------------------------------ |
| Offline-First Sync | Must     | Todo   | Work perfectly offline, sync seamlessly when online. No "sync failed" errors. |

### Attachment Handling

| Feature          | Priority | Comment                                                |
| ---------------- | -------- | ------------------------------------------------------ |
| Drag and Drop    | Must     | Insert images and files by dragging files into editor. |
| Resize and Align | Should   | Adjust size/alignment via UI or markdown attributes.   |
| Relative Paths   | Must     | Support local image paths relative to doc              |
| Cloud sync       | Could    | Sync images with collaborators                         |

### Accessibility

| Feature             | Priority | Comment                                            |
| ------------------- | -------- | -------------------------------------------------- |
| Keyboard Navigation | Should   | Full shortcuts for all actions.                    |
| Colourblind Modes   | Should   | Adjusted colour schemes.                           |
| High Contrast       | Could    | Toggle for better visibility.                      |
| Dictation           | Could    | Speech-to-text using Web Speech API or Whisper.js. |
| Text to Speech      | Could    | Read selected text aloud using Web Speech API.     |

### Integrations

| Feature                         | Priority | Status | Comment                          |
| ------------------------------- | -------- | ------ | -------------------------------- |
| Git Integration                 | Could    | Todo   | Commit/push .md files to repos.  |
| Integration with External Tools | Could    | Todo   | APIs or hooks for extensibility. |

## Core Philosophy: "Markdown that just works with others"

**Key Principles:**

1. **Simplicity over features** - Fewer features, done perfectly
2. **Zero configuration** - Open, write, share. No setup required
4. **Invisible complexity** - Collaboration, sync, conflict resolution happen seamlessly
5. **"It just works"** - Local files, cloud sync, collaboration work together without user thinking

## UX Refinements

**Apple-level polish:**

1. **Keyboard Shortcuts**
   - Every action has a shortcut
   - Consistent with platform conventions (Cmd+S saves, etc.)
2. **Collaboration UX**
   - Smooth cursor following (like Google Docs)
   - Beautiful presence indicators
   - Conflict resolution is invisible
3. **Writing Experience**
   - Markdown syntax fades as you type
   - Smart auto-complete for markdown
   - Inline formatting hints (subtle)
4. **File Management**
   - Drag-and-drop files/folders
   - Quick file switcher (Cmd+P)
   - Recent files in menu
   - Workspace persistence

---

**Removing everything that doesn't serve the core experience** and **perfecting what remains**. Orca should feel like the markdown editor you didn't know you needed, but can't live without once you use it.
