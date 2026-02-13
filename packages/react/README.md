# @editneo/react

The React component layer for EditNeo. This package provides `NeoEditor` (the root editor component), a set of ready-made block renderers, interactive UI components like the floating toolbar and slash-command menu, and hooks for reading and manipulating editor state.

Each `NeoEditor` instance creates its own isolated store, so multiple editors on the same page work independently. Rendering is virtualized with `@tanstack/react-virtual`, so documents with thousands of blocks remain responsive.

## Installation

```bash
npm install @editneo/react @editneo/core
```

React 18 or 19 is required as a peer dependency.

**Optional packages:**

```bash
npm install @editneo/sync  # For real-time collaboration & offline persistence
npm install @editneo/pdf   # For PDF drag-and-drop import
```

## Getting Started

A minimal working editor:

```tsx
import { NeoEditor } from "@editneo/react";

function App() {
  return <NeoEditor id="my-document" />;
}
```

The `id` prop is a unique identifier for the document. It is used to namespace IndexedDB storage and sync rooms.

## Components

### `<NeoEditor />`

The root component. It creates a per-instance editor store, sets up the optional `SyncManager`, applies the theme, and renders the virtualized block canvas.

| Prop          | Type                                              | Default  | Description                                                     |
| ------------- | ------------------------------------------------- | -------- | --------------------------------------------------------------- |
| `id`          | `string`                                          | required | Unique document identifier                                      |
| `offline`     | `boolean`                                         | `true`   | Enable offline persistence via IndexedDB                        |
| `syncConfig`  | `{ url: string; room: string }`                   | —        | WebSocket server URL and room name for real-time collaboration  |
| `theme`       | `{ mode: 'light' \| 'dark'; [key: string]: any }` | —        | Theme configuration                                             |
| `renderBlock` | `(block, defaultRender) => ReactNode`             | —        | Intercept rendering for custom block types                      |
| `className`   | `string`                                          | —        | CSS class for the outer wrapper                                 |
| `children`    | `ReactNode`                                       | —        | Toolbar, menus, or other UI to render inside the editor context |

> **Note:** `@editneo/sync` is lazy-loaded via dynamic `import()` and only instantiated when `syncConfig` or `offline` is set. If the package isn't installed, the editor works fine without it.

**Usage with collaboration:**

```tsx
<NeoEditor
  id="shared-doc"
  syncConfig={{
    url: "wss://your-yjs-server.com",
    room: "shared-doc",
  }}
  theme={{ mode: "dark" }}
>
  <Aeropeak />
  <SlashMenu />
  <CursorOverlay />
</NeoEditor>
```

**Custom block rendering:**

```tsx
<NeoEditor
  id="doc"
  renderBlock={(block, defaultRender) => {
    if (block.type === "spreadsheet") {
      return <SpreadsheetEmbed block={block} />;
    }
    return defaultRender;
  }}
/>
```

### `<NeoCanvas />`

The virtualized document canvas. It renders only the blocks currently visible in the viewport, using `@tanstack/react-virtual` for smooth scrolling. Block size estimates are type-aware (headings are taller than paragraphs, code blocks taller still). You typically don't render this directly — `NeoEditor` includes it automatically.

### `<BlockRenderer />`

Routes each block to the correct renderer based on its `type` field. Supports all built-in block types:

- **Text blocks:** paragraph, heading-1, heading-2, heading-3
- **Lists:** bullet-list, ordered-list, todo-list
- **Media:** image, video
- **Structural:** quote, callout, divider, code-block

If `renderBlock` is provided through the editor context, it is called first, giving you the chance to handle custom types before falling through to the defaults.

### `<EditableBlock />`

Handles the content-editable rendering and input processing for a single block. It converts the block's `Span[]` content into styled inline elements (bold, italic, code, underline, strikethrough, links, colors, highlights). It also handles:

- **Enter** — split the block and create a new paragraph
- **Backspace** at the start — delete the block
- **Ctrl+Z / Ctrl+Y** — undo / redo
- **Shift+Enter** — soft line break (`<br>`)
- **Tab** — indent the block (increases indent level)
- Input events parsed from the DOM, preserving inline formatting

---

## Interactive Components

### `<Aeropeak />` — Floating Toolbar

A toolbar that appears above the user's text selection. By default it shows Bold, Italic, Underline, Strikethrough, Code, and Link buttons. SSR-safe.

| Prop        | Type                          | Default  | Description                                  |
| ----------- | ----------------------------- | -------- | -------------------------------------------- |
| `children`  | `ReactNode`                   | —        | Custom toolbar content (replaces defaults)   |
| `offset`    | `number`                      | `10`     | Vertical offset from the selection in pixels |
| `animation` | `'fade' \| 'scale' \| 'none'` | `'fade'` | Appearance animation                         |

```tsx
// Default toolbar
<Aeropeak />

// Custom toolbar
<Aeropeak offset={12} animation="scale">
  <AeroButton
    icon={<strong>B</strong>}
    label="Bold"
    onClick={(editor) => editor.toggleMark?.('bold')}
  />
  <Separator />
  <AeroButton
    icon={<em>I</em>}
    label="Italic"
    onClick={(editor) => editor.toggleMark?.('italic')}
  />
</Aeropeak>
```

**Compound components:**

- `Aeropeak.Bold` / `Aeropeak.Italic` / `Aeropeak.Underline` / `Aeropeak.Strike` / `Aeropeak.Code` / `Aeropeak.Link` — prebuilt buttons
- `AeroButton` — a button that receives the editor instance when clicked
- `Separator` — a thin vertical divider between button groups

### `<SlashMenu />` — Command Palette

Appears when the user types `/` in the editor. Lists available block types, supports keyboard navigation (arrow keys + Enter), and filters results as the user continues typing after `/`.

| Prop             | Type                            | Default | Description                                            |
| ---------------- | ------------------------------- | ------- | ------------------------------------------------------ |
| `customCommands` | `CommandItem[]`                 | `[]`    | Additional commands to show alongside the defaults     |
| `filter`         | `(cmd: CommandItem) => boolean` | —       | Filter function to hide certain commands               |
| `menuComponent`  | `React.ComponentType`           | —       | Completely replace the menu UI with a custom component |

**Built-in commands:** Paragraph, Heading 1-3, Bulleted List, Ordered List, To-do List, Quote, Code Block, Divider, Callout, Image.

New blocks are inserted immediately **after** the current block.

```tsx
<SlashMenu
  customCommands={[
    {
      key: "diagram",
      label: "Diagram",
      icon: <span>chart</span>,
      execute: (editor) => editor.addBlock("image"),
    },
  ]}
/>
```

### `<PDFDropZone />`

A wrapper component that detects PDF file drops, runs client-side extraction via `@editneo/pdf`, and inserts the extracted blocks into the editor. Shows a processing indicator while extraction is in progress.

| Prop            | Type                                        | Default | Description                                                                          |
| --------------- | ------------------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `onDrop`        | `(files: File[]) => void`                   | —       | Callback when files are dropped. If provided, the default PDF extraction is skipped. |
| `renderOverlay` | `(props: { isOver: boolean }) => ReactNode` | —       | Custom overlay content shown during drag-over                                        |
| `children`      | `ReactNode`                                 | —       | Content inside the drop zone                                                         |

> **Note:** `@editneo/pdf` is lazy-loaded via dynamic `import()`. If the package isn't installed, the drop zone logs a warning and does nothing.

### `<CursorOverlay />`

Displays colored cursors and name labels for remote collaborators. Cursor positions are calculated using `Range.getBoundingClientRect()` for pixel-accurate placement, and updated automatically via `MutationObserver` when the DOM changes.

| Prop          | Type                                   | Default | Description                              |
| ------------- | -------------------------------------- | ------- | ---------------------------------------- |
| `renderLabel` | `(user: { name, color }) => ReactNode` | —       | Custom label renderer for remote cursors |

```tsx
<NeoEditor id="doc" syncConfig={{ url: "wss://...", room: "doc" }}>
  <CursorOverlay />
</NeoEditor>
```

---

## Block Components

All block components are exported and can be used standalone if needed:

| Component      | Block Type          | Description                                        |
| -------------- | ------------------- | -------------------------------------------------- |
| `HeadingBlock` | heading-1/2/3       | Renders `<h1>`, `<h2>`, or `<h3>`                  |
| `ListBlock`    | bullet/ordered/todo | Supports numbered lists and interactive checkboxes |
| `CodeBlock`    | code-block          | Monospace code with language support               |
| `QuoteBlock`   | quote               | Bordered blockquote                                |
| `CalloutBlock` | callout             | Highlighted callout box                            |
| `DividerBlock` | divider             | Horizontal rule                                    |
| `MediaBlock`   | image, video        | Image/video with src, alt, width, height props     |

---

## Hooks

### `useEditor()`

The primary hook for interacting with the editor. Must be called inside a `<NeoEditor />`. Returns all store state and actions.

```tsx
const {
  blocks, // Record<string, NeoBlock>
  rootBlocks, // string[]
  selection, // { blockId, startOffset, endOffset }
  addBlock, // (type, afterId?) => void
  insertBlock, // alias for addBlock
  insertFullBlock, // (block, afterId?) => void
  updateBlock, // (id, partial) => void
  deleteBlock, // (id) => void
  moveBlock, // (id, afterId) => void
  setBlockType, // (id, type) => void
  toggleMark, // (mark) => void
  setLink, // (url | null) => void
  exportJSON, // () => { blocks, rootBlocks }
  importJSON, // (data) => void
  undo, // () => void
  redo, // () => void
} = useEditor();
```

Throws an error if called outside of `<NeoEditor />`.

### `useSelection()`

A focused hook that subscribes only to the selection state, minimizing re-renders.

```tsx
const selection = useSelection();
// { blockId: string | null, startOffset: number, endOffset: number }
```

### `useSyncStatus()`

Returns the current sync connection status.

```tsx
const status = useSyncStatus();
// 'connected' or 'disconnected'
```

---

## Theming

`NeoEditor` scopes CSS variables to its root element, so multiple editors on the same page can have different themes without conflicts. Override any variable in your stylesheet:

```css
:root {
  --neo-font-family: "Inter", system-ui, sans-serif;
  --neo-font-size-body: 16px;
  --neo-code-font: "Fira Code", "Consolas", monospace;
  --neo-accent-color: #3b82f6;
  --neo-bg-canvas: #ffffff;
  --neo-text-primary: #111827;
  --neo-text-secondary: #6b7280;
  --neo-selection-color: #b4d5fe;
  --neo-border-color: #e5e7eb;
  --neo-border-radius: 4px;
  --neo-block-spacing: 4px;
  --neo-content-width: 800px;
}
```

Switch modes via the `theme` prop or via the `data-theme` attribute:

```tsx
<NeoEditor id="doc" theme={{ mode: "dark" }} />
```

## Exports

Everything is exported from the package root:

```typescript
// Components
export { NeoEditor, EditorContext } from "./NeoEditor";
export { NeoCanvas } from "./NeoCanvas";
export { EditableBlock } from "./EditableBlock";
export { BlockRenderer } from "./BlockRenderer";

// Block renderers
export {
  HeadingBlock,
  ListBlock,
  MediaBlock,
  CodeBlock,
  QuoteBlock,
  CalloutBlock,
  DividerBlock,
} from "./blocks/*";

// Interactive UI
export {
  PDFDropZone,
  CursorOverlay,
  Aeropeak,
  SlashMenu,
} from "./components/*";

// Hooks
export { useEditor, useSelection, useSyncStatus } from "./hooks";
```

## License

MIT
