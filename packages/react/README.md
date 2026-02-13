# @editneo/react

The React component layer for EditNeo. This package provides `NeoEditor` (the root editor component), a set of ready-made block renderers, interactive UI components like the floating toolbar and slash-command menu, and hooks for reading and manipulating editor state.

Rendering is virtualized with `@tanstack/react-virtual`, so documents with thousands of blocks remain responsive.

## Installation

```bash
npm install @editneo/react @editneo/core
```

React 18 or 19 is required as a peer dependency.

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

The root component. It sets up the editor context, initializes the optional `SyncManager`, applies the theme, and renders the virtualized block canvas.

| Prop          | Type                                              | Default  | Description                                                     |
| ------------- | ------------------------------------------------- | -------- | --------------------------------------------------------------- |
| `id`          | `string`                                          | required | Unique document identifier                                      |
| `offline`     | `boolean`                                         | `true`   | Enable offline persistence via IndexedDB                        |
| `syncConfig`  | `{ url: string; room: string }`                   | —        | WebSocket server URL and room name for real-time collaboration  |
| `theme`       | `{ mode: 'light' \| 'dark'; [key: string]: any }` | —        | Theme configuration                                             |
| `renderBlock` | `(block, defaultRender) => ReactNode`             | —        | Intercept rendering for custom block types                      |
| `className`   | `string`                                          | —        | CSS class for the outer wrapper                                 |
| `children`    | `ReactNode`                                       | —        | Toolbar, menus, or other UI to render inside the editor context |

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
</NeoEditor>
```

**Custom block rendering:**

If you have custom block types beyond the built-in ones, use `renderBlock` to intercept them:

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

The virtualized document canvas. It renders only the blocks currently visible in the viewport, using `@tanstack/react-virtual` for smooth scrolling through large documents. You typically don't render this directly — `NeoEditor` includes it automatically.

### `<BlockRenderer />`

Routes each block to the correct renderer based on its `type` field. Supports all built-in block types:

- **Text blocks:** paragraph, heading-1, heading-2, heading-3
- **Lists:** bullet-list, ordered-list, todo-list
- **Media:** image, video
- **Structural:** quote, callout, divider, code-block

If `renderBlock` is provided through the editor context, it is called first, giving you the chance to handle custom types before falling through to the defaults.

### `<EditableBlock />`

Handles the content-editable rendering and input processing for a single block. It converts the block's `Span[]` content into styled inline elements (bold, italic, code, underline, strikethrough, links). It also handles:

- Enter key to split the block and create a new paragraph
- Backspace at the start of a block to delete it
- Input events to update the block's text content

---

## Interactive Components

### `<Aeropeak />` — Floating Toolbar

A toolbar that appears above the user's text selection. By default it shows Bold, Italic, Strikethrough, and Link buttons. You can replace the default buttons with your own by passing children.

| Prop        | Type                          | Default  | Description                                  |
| ----------- | ----------------------------- | -------- | -------------------------------------------- |
| `children`  | `ReactNode`                   | —        | Custom toolbar content (replaces defaults)   |
| `offset`    | `number`                      | `10`     | Vertical offset from the selection in pixels |
| `animation` | `'fade' \| 'scale' \| 'none'` | `'fade'` | Appearance animation                         |

```tsx
// Default toolbar with Bold, Italic, Strike, Link
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

- `Aeropeak.Bold` / `Aeropeak.Italic` / `Aeropeak.Strike` / `Aeropeak.Link` — prebuilt buttons
- `AeroButton` — a button that receives the editor instance when clicked
- `Separator` — a thin vertical divider between button groups

### `<SlashMenu />` — Command Palette

Appears when the user types `/` in the editor. Lists available block types, supports keyboard navigation (arrow keys + enter), and filters results as the user continues typing.

| Prop             | Type                            | Default | Description                                            |
| ---------------- | ------------------------------- | ------- | ------------------------------------------------------ |
| `customCommands` | `CommandItem[]`                 | `[]`    | Additional commands to show alongside the defaults     |
| `filter`         | `(cmd: CommandItem) => boolean` | —       | Filter function to hide certain commands               |
| `menuComponent`  | `React.ComponentType`           | —       | Completely replace the menu UI with a custom component |

**Built-in commands:** Paragraph, Heading 1-3, Bulleted List, Ordered List, To-do List, Quote, Code Block, Divider, Callout, Image.

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

**`CommandItem` interface:**

```typescript
interface CommandItem {
  key: string; // Unique key
  label: string; // Display label
  icon?: ReactNode; // Icon element
  execute: (editor: any) => void; // Action to perform
}
```

### `<PDFDropZone />`

A wrapper component that detects PDF file drops and runs client-side extraction to convert the PDF into editor blocks.

| Prop            | Type                                        | Default | Description                                                                          |
| --------------- | ------------------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `onDrop`        | `(files: File[]) => void`                   | —       | Callback when files are dropped. If provided, the default PDF extraction is skipped. |
| `renderOverlay` | `(props: { isOver: boolean }) => ReactNode` | —       | Custom overlay content shown during drag-over                                        |
| `children`      | `ReactNode`                                 | —       | Content inside the drop zone                                                         |

```tsx
<PDFDropZone>{/* Your editor content goes inside */}</PDFDropZone>
```

### `<CursorOverlay />`

Displays colored cursors and labels for remote collaborators when using real-time sync. Each user's cursor position is tracked through Yjs awareness.

```tsx
<NeoEditor id="doc" syncConfig={{ url: "wss://...", room: "doc" }}>
  <CursorOverlay />
</NeoEditor>
```

Cursor colors are assigned automatically based on the user's awareness client ID.

---

## Hooks

### `useEditor()`

The primary hook for interacting with the editor. Must be called inside a `<NeoEditor />`. Returns all store state and actions, plus convenience aliases.

```tsx
const {
  blocks, // Record<string, NeoBlock>
  rootBlocks, // string[]
  selection, // { blockId, startOffset, endOffset }
  addBlock, // (type, afterId?) => void
  insertBlock, // alias for addBlock
  updateBlock, // (id, partial) => void
  deleteBlock, // (id) => void
  toggleMark, // (mark) => void
  undo, // () => void
  redo, // () => void
} = useEditor();
```

Throws an error if called outside of `<NeoEditor />`.

### `useSelection()`

A focused hook that subscribes only to the selection state, minimizing re-renders in components that don't care about the full document.

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

`NeoEditor` applies a set of CSS variables to the document root. You can override them globally in your stylesheet:

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
```

Or switch between light and dark mode via the `theme` prop:

```tsx
<NeoEditor id="doc" theme={{ mode: "dark" }} />
```

Dark mode sets `--neo-bg-canvas` to `#0f172a` and `--neo-text-primary` to `#f3f4f6`.

## Exports

Everything is exported from the package root:

```typescript
// Components
export { NeoEditor, EditorContext } from "./NeoEditor";
export { NeoCanvas } from "./NeoCanvas";
export { EditableBlock } from "./EditableBlock";

// Interactive UI
export { PDFDropZone } from "./components/PDFDropZone";
export { CursorOverlay } from "./components/CursorOverlay";
export { Aeropeak, AeroButton, Separator } from "./components/Aeropeak";
export { SlashMenu } from "./components/SlashMenu";

// Hooks
export { useEditor, useSelection, useSyncStatus } from "./hooks";
```

## License

MIT
