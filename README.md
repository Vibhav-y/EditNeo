<p align="center">
  <img src="https://img.shields.io/npm/v/@editneo/core?style=flat-square&color=0ea5e9&label=core" alt="core version" />
  <img src="https://img.shields.io/npm/v/@editneo/react?style=flat-square&color=8b5cf6&label=react" alt="react version" />
  <img src="https://img.shields.io/npm/v/@editneo/sync?style=flat-square&color=10b981&label=sync" alt="sync version" />
  <img src="https://img.shields.io/npm/v/@editneo/pdf?style=flat-square&color=f59e0b&label=pdf" alt="pdf version" />
  <br />
  <img src="https://img.shields.io/github/actions/workflow/status/Vibhav-y/EditNeo/ci.yml?style=flat-square&label=CI" alt="CI" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<h1 align="center">✦ EditNeo</h1>

<p align="center">
  <strong>A modular, block-based rich text editor for React.</strong><br/>
  CRDT-powered collaboration · PDF transmutation · Offline-first · Fully typed.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-packages">Packages</a> ·
  <a href="#-api-reference">API Reference</a> ·
  <a href="#-contributing">Contributing</a>
</p>

---

## ⚡ Quick Start

```bash
npm install @editneo/react @editneo/core
```

```tsx
import { NeoEditor } from "@editneo/react";

function App() {
  return <NeoEditor id="my-document" theme={{ mode: "dark" }} />;
}
```

That's it. You have a working block editor with undo/redo, rich text, and slash commands.

---

## 📦 Packages

EditNeo is a monorepo with focused, independent packages. Install only what you need.

| Package                           | Description                                       | Size     |
| --------------------------------- | ------------------------------------------------- | -------- |
| [`@editneo/core`](#editneocore)   | Block types, editor store, undo/redo engine       | Tiny     |
| [`@editneo/react`](#editneoreact) | React components — NeoEditor, Aeropeak, SlashMenu | Core     |
| [`@editneo/sync`](#editneosync)   | Yjs CRDT sync — offline + real-time collaboration | Optional |
| [`@editneo/pdf`](#editneopdf)     | PDF → blocks transmutation engine                 | Optional |

### Dependency Graph

```
@editneo/react ──→ @editneo/core
                ──→ @editneo/sync (optional)
                ──→ @editneo/pdf  (optional)
@editneo/sync  ──→ @editneo/core
@editneo/pdf   ──→ @editneo/core
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   Your App                       │
├─────────────────────────────────────────────────┤
│   @editneo/react                                │
│   ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│   │NeoEditor │ │ Aeropeak │ │  SlashMenu    │  │
│   └────┬─────┘ └──────────┘ └───────────────┘  │
│        │                                         │
│   ┌────▼─────┐ ┌──────────┐ ┌───────────────┐  │
│   │NeoCanvas │ │PDFDropZone│ │CursorOverlay │  │
│   │(virtual) │ └──────────┘ └───────────────┘  │
│   └────┬─────┘                                   │
│        │                                         │
│   ┌────▼──────────────────────────────────────┐ │
│   │  BlockRenderer → EditableBlock / Blocks   │ │
│   └───────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│   @editneo/core              @editneo/sync      │
│   ┌──────────────┐          ┌───────────────┐  │
│   │ EditorStore  │◄────────►│ SyncManager   │  │
│   │ (Zustand)    │          │ (Yjs + IDB)   │  │
│   └──────────────┘          └───────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 📖 API Reference

### `@editneo/core`

The headless engine. Framework-agnostic types and state management.

#### Block Types

```typescript
type BlockType =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bullet-list"
  | "ordered-list"
  | "todo-list"
  | "code-block"
  | "image"
  | "video"
  | "pdf-page"
  | "quote"
  | "divider"
  | "callout";
```

#### Rich Text Spans

Each block contains an array of `Span` objects for inline formatting:

```typescript
interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string; // e.g. "#ef4444"
  highlight?: string; // e.g. "#fef08a"
  link?: string; // e.g. "https://..."
}
```

#### NeoBlock

```typescript
interface NeoBlock {
  id: string;
  type: BlockType;
  content: Span[];
  props: Record<string, any>; // Block-specific metadata
  children: string[]; // Nested block IDs
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}
```

#### Editor Store (Zustand)

```typescript
import { useEditorStore } from "@editneo/core";

// Read state
const blocks = useEditorStore((s) => s.blocks);
const rootBlocks = useEditorStore((s) => s.rootBlocks);

// Actions
const { addBlock, updateBlock, deleteBlock, toggleMark, undo, redo } =
  useEditorStore.getState();

addBlock("heading-1"); // Add at end
addBlock("paragraph", "block-3"); // Add after specific block
updateBlock("block-1", { content: [{ text: "Hello" }] });
deleteBlock("block-2");
toggleMark("bold"); // Toggle on selected block
undo();
redo();
```

---

### `@editneo/react`

Drop-in React components with virtualized rendering.

#### `<NeoEditor />`

The root editor component. Wraps everything in context.

```tsx
import { NeoEditor } from "@editneo/react";

<NeoEditor
  id="doc-123" // Required — unique document ID
  offline={true} // Enable IndexedDB persistence (default: true)
  syncConfig={{
    // Optional — enable real-time collaboration
    url: "wss://your-server.com",
    room: "doc-123",
  }}
  theme={{ mode: "dark" }} // 'light' | 'dark'
  renderBlock={(block, defaultRender) => {
    // Intercept rendering for custom block types
    if (block.type === "custom-widget") {
      return <MyWidget block={block} />;
    }
    return defaultRender;
  }}
  className="my-editor"
>
  {/* Optional: toolbar, menus, etc. */}
</NeoEditor>;
```

#### Hooks

```tsx
import { useEditor, useSelection, useSyncStatus } from "@editneo/react";

function MyToolbar() {
  const { insertBlock, toggleMark, undo, redo } = useEditor();
  const selection = useSelection();
  const status = useSyncStatus(); // 'connected' | 'disconnected'

  return (
    <div>
      <button onClick={() => toggleMark("bold")}>Bold</button>
      <button onClick={() => insertBlock("heading-1")}>H1</button>
      <button onClick={undo}>↩ Undo</button>
      <button onClick={redo}>↪ Redo</button>
      <span>{status === "connected" ? "🟢" : "🔴"}</span>
    </div>
  );
}
```

#### `<Aeropeak />` — Floating Toolbar

Appears automatically when the user selects text. Fully composable.

```tsx
import { Aeropeak, AeroButton, Separator } from '@editneo/react';

// Default (Bold, Italic, Strike, Link)
<NeoEditor id="doc">
  <Aeropeak />
</NeoEditor>

// Custom toolbar
<Aeropeak offset={12} animation="scale">
  <AeroButton icon={<strong>B</strong>} label="Bold" onClick={(e) => e.toggleMark?.('bold')} />
  <Separator />
  <AeroButton icon={<em>I</em>} label="Italic" onClick={(e) => e.toggleMark?.('italic')} />
</Aeropeak>
```

#### `<SlashMenu />` — Command Palette

Triggered by typing `/` in an empty block. Supports filtering + custom commands.

```tsx
import { SlashMenu } from "@editneo/react";

<NeoEditor id="doc">
  <SlashMenu
    commands={[
      { label: "Alert Box", icon: "🚨", type: "callout" },
      { label: "Diagram", icon: "📊", action: () => insertDiagram() },
    ]}
  />
</NeoEditor>;
```

**Built-in commands:** Heading 1-3, Bullet List, Ordered List, To-Do, Quote, Divider, Code Block, Image, Callout.

#### `<PDFDropZone />`

Drag-and-drop PDF import with intelligent block extraction.

```tsx
import { PDFDropZone } from "@editneo/react";

<NeoEditor id="doc">
  <PDFDropZone
    onDrop={(files) => console.log("Dropped:", files)}
    renderOverlay={({ isOver }) =>
      isOver && <div className="drop-glow">✨ Release to Transmute</div>
    }
  >
    <NeoCanvas />
  </PDFDropZone>
</NeoEditor>;
```

#### `<CursorOverlay />`

Shows remote collaborators' cursors in real time.

```tsx
import { CursorOverlay } from "@editneo/react";

<NeoEditor id="doc" syncConfig={{ url: "wss://...", room: "doc-123" }}>
  <CursorOverlay />
</NeoEditor>;
```

---

### `@editneo/sync`

CRDT-based real-time collaboration and offline persistence.

```typescript
import { SyncManager } from "@editneo/sync";

const sync = new SyncManager("doc-123", {
  url: "wss://your-yjs-server.com",
  room: "doc-123",
});

// Sync a local block change to Yjs
sync.syncBlock(updatedBlock);

// Sync root block order
sync.syncRoot(["block-1", "block-2", "block-3"]);

// Access awareness (for cursor positions)
const awareness = sync.awareness;

// Cleanup
sync.destroy();
```

**Features:**

- 🔄 **2-way sync** — Zustand ↔ Yjs, conflict-free
- 💾 **Offline-first** — IndexedDB persistence via `y-indexeddb`
- 🌐 **Real-time** — WebSocket provider via `y-websocket`
- 👥 **Awareness** — Track remote cursor positions

---

### `@editneo/pdf`

Client-side PDF transmutation into editable blocks.

```typescript
import { extractBlocksFromPdf } from "@editneo/pdf";

const buffer = await file.arrayBuffer();
const blocks = await extractBlocksFromPdf(buffer);
// Returns: NeoBlock[] — paragraphs, headings, images extracted from PDF
```

---

## 🎨 Theming

EditNeo uses CSS variables for theming. Override them in your stylesheet:

```css
:root {
  --neo-font-family: "Inter", system-ui, sans-serif;
  --neo-font-size-body: 16px;
  --neo-accent-color: #3b82f6;
  --neo-bg-canvas: #ffffff;
  --neo-text-primary: #111827;
  --neo-border-radius: 4px;
  --neo-block-spacing: 4px;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  :root {
    --neo-bg-canvas: #0f172a;
    --neo-text-primary: #f3f4f6;
  }
}
```

Or pass theme programmatically:

```tsx
<NeoEditor id="doc" theme={{ mode: "dark" }} />
```

---

## 🛠️ Development

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 11

### Setup

```bash
git clone https://github.com/Vibhav-y/EditNeo.git
cd EditNeo
npm install
```

### Commands

| Command               | Description                       |
| --------------------- | --------------------------------- |
| `npm run build`       | Build all packages (`dist/`)      |
| `npm run dev`         | Start dev servers                 |
| `npm run check-types` | TypeScript type checking          |
| `npm run lint`        | Lint all packages                 |
| `npm run format`      | Format with Prettier              |
| `npm run changeset`   | Create a changeset for versioning |
| `npm run release`     | Build + publish to npm            |

### Project Structure

```
EditNeo/
├── apps/
│   ├── docs/         # Documentation site (Next.js)
│   └── web/          # Demo site (Next.js)
├── packages/
│   ├── core/         # @editneo/core — types, store, engine
│   │   └── src/
│   │       ├── types.ts    # BlockType, Span, NeoBlock, EditorState
│   │       ├── store.ts    # Zustand store with undo/redo
│   │       └── index.ts
│   ├── react/        # @editneo/react — UI components
│   │   └── src/
│   │       ├── NeoEditor.tsx
│   │       ├── NeoCanvas.tsx       # Virtualized block rendering
│   │       ├── EditableBlock.tsx   # Rich text input
│   │       ├── BlockRenderer.tsx   # Block type switch
│   │       ├── hooks.ts
│   │       ├── styles.css
│   │       ├── blocks/             # HeadingBlock, ListBlock, etc.
│   │       └── components/         # Aeropeak, SlashMenu, etc.
│   ├── sync/         # @editneo/sync — Yjs CRDT manager
│   │   └── src/
│   │       └── index.ts
│   └── pdf/          # @editneo/pdf — PDF extraction
│       └── src/
│           └── worker.ts
├── turbo.json
├── tsconfig.json
└── package.json
```

---

## 🚀 Publishing

EditNeo uses [Changesets](https://github.com/changesets/changesets) for versioning and GitHub Actions for CI/CD.

### Release Flow

```
You commit → Push to main → CI runs (build + type check)
                           → Changeset bot creates "Version Packages" PR
                           → You merge the PR → Packages published to npm 🎉
```

### Creating a Release

```bash
# 1. After making changes, create a changeset
npm run changeset
# → Select affected packages
# → Choose version bump (patch / minor / major)
# → Write a summary of changes

# 2. Commit and push
git add . && git commit -m "feat: add new block type" && git push

# 3. GitHub Actions handles the rest!
```

---

## 🤝 Contributing

1. **Fork** the repo
2. **Clone** your fork
3. **Create a branch** — `git checkout -b feat/my-feature`
4. **Make changes** and ensure `npm run check-types` passes
5. **Create a changeset** — `npm run changeset`
6. **Push** and open a Pull Request

### Code Style

- TypeScript strict mode
- Prettier for formatting (`npm run format`)
- One component per file

---

## 📄 License

MIT © [Vibhav](https://github.com/Vibhav-y)
