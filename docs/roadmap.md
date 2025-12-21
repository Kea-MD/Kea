# Orca Roadmap

> A phased approach to building the collaborative Markdown editor.

## Philosophy

**Build the smallest thing that's genuinely useful, then iterate.**

Each phase should result in something people can actually use. No "infrastructure-only" phases—every milestone delivers user value.

---

## Phase 0: Foundation (Week 1-2)

> **Goal:** Basic editor that can open, edit, and save markdown files.

### Deliverables

- [ ] Project setup (Vite + Vue 3 + TypeScript + Tailwind)
- [ ] TipTap editor with basic markdown support
- [ ] Parse markdown file → ProseMirror document
- [ ] Serialize ProseMirror document → markdown file
- [ ] Basic UI shell (editor area + sidebar placeholder)
- [ ] Dark/light mode with system detection

### Definition of Done

**A user can open a markdown file, edit it, and save changes.**

### Technical Tasks

```
1. Initialize Vite project with Vue 3 + TypeScript
2. Set up Tailwind CSS with custom design tokens
3. Set up Pinia for state management
4. Install and configure TipTap with StarterKit
5. Create markdown parser (remark → ProseMirror)
6. Create markdown serializer (ProseMirror → string)
7. Build basic Editor.vue component
8. Implement file open dialog (web: file input, later: Tauri)
9. Implement file save (web: download, later: Tauri)
10. Add dark/light theme toggle
11. Basic responsive layout
```

### Success Metrics

- Open any CommonMark-compliant .md file without errors
- Round-trip: open → edit → save preserves formatting
- Editor renders in < 100ms

---

## Phase 1: File Management

> **Goal:** Work with multiple files and folders like a native app.

### Deliverables

- [ ] File browser sidebar (tree view)
- [ ] Create new files/folders
- [ ] Rename and delete files
- [ ] Quick file switcher (`Cmd+P`)
- [ ] Recent files list
- [ ] View all files in a folder, greying out non-markdown files.
- [ ] Be able to use native menu bar for file operations. (Open, Save, Save As, etc.)
- [ ] Tab bar for open files
- [ ] Tauri integration (native filesystem)
- [ ] Native file associations (.md opens in Orca)
- [ ] Be able to open folder, and see all files in the folder.
  

### Definition of Done

**A developer would use this to manage their documentation folder.**

### Technical Tasks

```
1. Build FileTree component with recursive rendering
2. Implement create/rename/delete operations
3. Add drag-and-drop reordering
4. Build QuickSwitcher modal with fuzzy search
5. Implement recent files storage (localStorage)
6. Create TabBar component for open documents
7. Set up Tauri project structure
8. Implement Tauri file system commands
9. Configure file associations for .md
10. Add unsaved changes indicator + confirmation
```

### Success Metrics

## Phase 2: Core Editor

> **Goal:** A polished, standalone markdown editor worth using.

### Deliverables

- [ ] Full GFM support (tables, task lists, strikethrough)
- [ ] Code blocks with syntax highlighting (Shiki)
- [ ] Inline images (drag & drop, relative paths)
- [ ] Smart paste (rich text → markdown)
- [ ] Auto-pairs for markdown syntax
- [ ] Find & replace with `Cmd+F`
- [ ] Outline view (table of contents from headers)
- [ ] Keyboard shortcuts for all formatting

### Definition of Done

**A writer would choose this over other markdown editors for daily use.**

### Technical Tasks

```
1. Implement table extension for TipTap
2. Implement task list extension
3. Build syntax fading logic (hide decorations on inactive lines)
4. Add Shiki for code highlighting
5. Create image upload/drop handler
6. Build smart paste handler (HTML → markdown)
7. Implement auto-pair extension
8. Add find/replace overlay
9. Build outline sidebar component
10. Map all shortcuts (Cmd+B, Cmd+I, etc.)
11. Add formatting toolbar (optional, hideable)
```

### Success Metrics

- Paste from Google Docs creates clean markdown
- 60fps scrolling with 10,000+ word documents
- All common markdown operations under 50ms

---

- Open folder with 1000 files, tree renders < 200ms
- Quick switcher responds to keystrokes < 50ms
- Native app size < 15MB

---

## Phase 3: P2P Collaboration & External Editor Sync (Week 7-10)

> **Goal:** Multiple people editing the same document simultaneously via P2P, with external editor (VS Code) support.

### Deliverables

- [ ] Yjs integration with TipTap
- [ ] y-webrtc provider for P2P sync
- [ ] FileSyncer for external editor compatibility
- [ ] Room code generation and joining
- [ ] Presence indicators (who's connected)
- [ ] Cursor sharing (see where others are typing)
- [ ] Room password support (E2E encryption)
- [ ] Sync status indicator (connected, peers, offline)
- [ ] File watcher for external changes (Tauri)

### Definition of Done

**Two people can write a document together—and either can also edit in VS Code—with all changes syncing seamlessly.**

### Technical Tasks

```
1. Integrate y-prosemirror with TipTap
2. Set up y-webrtc provider for P2P sync
3. Implement room code generation (adjective-noun-number)
4. Create room management UI (create, join, leave)
5. Build presence UI (peer list with colors)
6. Implement cursor decoration extension
7. Add optional room password (enables encryption)
8. Build FileSyncer class:
   a. File watcher integration (Tauri fs events)
   b. diff-match-patch for computing changes
   c. Convert diffs to Yjs operations
   d. Handle write debouncing and ignore flags
9. Test external editor scenarios (VS Code save while editing)
10. Build sync status indicator (P2P state)
11. Test CRDT conflict resolution scenarios
12. Deploy lightweight signaling server (or use public)
```

### Success Metrics

- P2P edits appear on other peers in < 100ms
- External editor changes sync within 1 second
- Support 10+ simultaneous peers without lag
- File round-trip (Orca → VS Code → Orca) preserves all content

---

## Phase 4: Polish & Settings (Week 11-12)

> **Goal:** Production-ready local-first experience with customization.

### Deliverables

- [ ] User preferences (theme, font, editor settings)
- [ ] Persistent user name/color for collaboration
- [ ] Recent files and room history
- [ ] Settings UI with live preview
- [ ] Export/import preferences
- [ ] Signaling server configuration

### Definition of Done

**Users have a polished, personalized experience with all settings persisting locally.**

### Technical Tasks

```
1. Build settings store (Pinia + localStorage)
2. Create settings UI with sections
3. Implement theme switching (live preview)
4. Add font family and size controls
5. Create collaboration settings (name, color)
6. Build recent files list (IndexedDB)
7. Add room history for quick rejoin
8. Implement custom signaling server config
9. Add export/import settings (JSON)
10. Create keyboard shortcut customization (future)
```

### Success Metrics

- Settings persist across sessions
- Theme switch is instant (no flash)
- Recent files load in < 50ms

---

## Phase 5: Polish & Performance (Week 13-14)

> **Goal:** Production-ready quality across all features.

### Deliverables

- [ ] Performance optimization pass
- [ ] Accessibility audit and fixes
- [ ] Error handling and recovery
- [ ] Loading states and skeletons
- [ ] Empty states and onboarding
- [ ] Keyboard shortcut cheat sheet
- [ ] Help documentation
- [ ] Analytics and error tracking

### Definition of Done

**Ready for public launch with confidence.**

### Technical Tasks

```
1. Profile and optimize render performance
2. Add code splitting and lazy loading
3. Implement service worker for offline
4. Full accessibility audit (axe, manual testing)
5. Add keyboard navigation to all UI
6. Build error boundary components
7. Create loading skeleton components
8. Design and implement empty states
9. Build first-run onboarding flow
10. Create keyboard shortcut modal
11. Write help documentation
12. Set up Sentry for error tracking
13. Add privacy-respecting analytics
```

### Success Metrics

- Lighthouse score > 95 all categories
- WCAG 2.1 AA compliance
- Error rate < 0.1% of sessions

---

## Future Phases

### Phase 6: Advanced Features

- [ ] Math rendering (KaTeX)
- [ ] Diagram support (Mermaid)
- [ ] PDF export with bookmarks
- [ ] Version history with visual diff
- [ ] Comments and suggestions
- [ ] Full-text search across documents

### Phase 7: Platform Expansion

- [ ] Windows native app
- [ ] Linux native app
- [ ] Mobile-responsive web
- [ ] iOS app (future)
- [ ] Android app (future)

### Phase 8: Advanced P2P & Self-Hosting

- [ ] TURN server for firewall traversal
- [ ] LAN-only mode (no internet required)
- [ ] Custom signaling server UI
- [ ] Room persistence (rejoin after disconnect)
- [ ] P2P file transfer for images/attachments

---

## Milestones Summary

| Milestone | Target | Deliverable |
|-----------|--------|-------------|
| **Alpha** | Week 6 | Standalone editor, file management |
| **Beta** | Week 10 | P2P collaboration, external editor sync |
| **v1.0** | Week 14 | Production-ready, all P0/P1 features |
| **v1.1** | Week 18 | Math, diagrams, PDF export |
| **v2.0** | Week 24 | Advanced features, mobile support |

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|------------|
| CRDT complexity | Start with Yjs (proven), thorough testing |
| P2P connectivity | y-webrtc handles NAT traversal; TURN fallback (future) |
| External editor sync | Robust diff algorithm, debouncing, extensive testing |
| Performance at scale | Early profiling, virtual scrolling |
| Cross-platform issues | CI testing on all platforms |

### Product Risks

| Risk | Mitigation |
|------|------------|
| Feature creep | Strict P0/P1 focus, say no often |
| UX complexity | User testing at each phase |
| Competition | Focus on unique value (simplicity) |
| Adoption | Ship early, iterate on feedback |

---

## Success Criteria for Launch

### Quantitative

- [ ] < 3 second time to interactive
- [ ] < 15MB desktop app size
- [ ] > 95 Lighthouse performance score
- [ ] < 0.1% error rate
- [ ] < 100ms P2P sync latency
- [ ] < 1s external editor sync latency

### Qualitative

- [ ] "This feels faster than VS Code" (editor)
- [ ] "I didn't know we were collaborating" (seamless P2P sync)
- [ ] "I can use VS Code and Orca together" (external editor support)
- [ ] "It just works" (overall UX)
- [ ] Would recommend to a friend (NPS > 50)

