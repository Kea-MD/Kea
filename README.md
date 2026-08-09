![Kea application icon](./src-tauri/icons/icon.png "Kea icon")

> **A Markdown editor that just works—with others.**

Kea is a local-first Markdown editor for people who want durable plain-text files, rich editing, and optional peer-to-peer collaboration. It keeps Markdown as the canonical document format while  providing rendered editing, Mermaid diagrams, mathematical notation, comments, provenance, relative assets, and other rich document capabilities through derived or companion layers.

## Key Features

- **Local-First**: Your Markdown files stay on your machine, with no required cloud storage
- **Rich Markdown**: Rendered editing with support for diagrams, maths, tables, images, and other Markdown extensions
- **Document Context**: Comments and optional provenance live in versioned companion metadata rather than changing the portable Markdown source
- **Collaboration-Ready**: Peer-to-peer collaboration is designed to degrade gracefully to local-only editing
- **Distraction-Free**: Minimal UI that keeps writing central
- **Cross-Platform**: macOS, Windows, Linux, and Web

> Collaboration and some rich editing capabilities are under active development. Markdown remains the canonical persisted document format.

## Quick Start

```bash
# Install dependencies
npm install

# Start the React development server
npm run dev

# Run the legacy Vue development server when needed
npm run dev:legacy

# Run the React Tauri development app
npm run tauri dev

# Build the React production app
npm run build

# Build the legacy Vue app when needed
npm run build:legacy
```

## License

[MIT License](LICENSE)
