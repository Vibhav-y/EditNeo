# @editneo/core

The headless engine behind EditNeo. This package contains the type definitions for the block-based document model, and a Zustand-powered state store with built-in undo/redo history. It has no dependency on React or any UI framework — you can use it anywhere.

## Installation

```bash
npm install @editneo/core
```

## Concepts

An EditNeo document is a flat map of **blocks**, each identified by a unique ID. A separate ordered array called `rootBlocks` determines the visual order. Every block contains an array of **spans** — small chunks of text that carry inline formatting metadata like bold, italic, or links.

This flat structure (rather than a deeply nested tree) makes CRDT-based collaboration straightforward, because each block can be individually addressed and merged.

## Types

### `BlockType`

All supported block types:

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

### `Span`

A span is a run of text with optional inline formatting. A single block's content is an array of spans, so mixed formatting within a block is represented by multiple spans side by side.

```typescript
interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string; // CSS color value, e.g. "#ef4444"
  highlight?: string; // Background highlight color
  link?: string; // URL the text links to
}
```

For example, the sentence "Hello **world**" would be represented as:

```typescript
[{ text: "Hello " }, { text: "world", bold: true }];
```

### `NeoBlock`

The fundamental unit of the document:

```typescript
interface NeoBlock {
  id: string; // UUID
  type: BlockType;
  content: Span[]; // The text content with formatting
  props: Record<string, any>; // Block-specific metadata (e.g. image src, language for code)
  children: string[]; // IDs of nested child blocks
  parentId: string | null; // ID of parent block, or null if root-level
  createdAt: number; // Unix timestamp
  updatedAt: number;
}
```

### `EditorState`

The complete editor state at any point in time:

```typescript
interface EditorState {
  blocks: Record<string, NeoBlock>; // All blocks, keyed by ID
  rootBlocks: string[]; // Ordered IDs of top-level blocks
  history: Partial<EditorState>[]; // Undo stack
  historyIndex: number; // Current position in history
  selection: {
    blockId: string | null; // Currently focused block
    startOffset: number;
    endOffset: number;
  };
}
```

## Editor Store

The store is a [Zustand](https://zustand-demo.pmnd.rs/) store. You can use it directly in React via the hook, or access it imperatively from anywhere.

### Using the hook (inside React components)

```typescript
import { useEditorStore } from "@editneo/core";

function MyComponent() {
  // Subscribe to specific slices to avoid unnecessary re-renders
  const blocks = useEditorStore((state) => state.blocks);
  const rootBlocks = useEditorStore((state) => state.rootBlocks);
  const selection = useEditorStore((state) => state.selection);
}
```

### Imperative access (outside React, in tests, etc.)

```typescript
import { useEditorStore } from "@editneo/core";

const state = useEditorStore.getState();
const { addBlock, updateBlock, deleteBlock, toggleMark, undo, redo } = state;
```

### Actions

#### `addBlock(type, afterId?)`

Creates a new empty block and inserts it into the document. If `afterId` is provided and exists in `rootBlocks`, the new block is placed immediately after it. Otherwise it is appended to the end. The previous state is pushed onto the undo stack.

```typescript
addBlock("paragraph"); // Appends a paragraph at the end
addBlock("heading-1", "block-abc"); // Inserts a heading after block-abc
```

#### `updateBlock(id, partial)`

Merges partial data into an existing block. The `updatedAt` timestamp is set automatically. History is recorded.

```typescript
updateBlock("block-abc", {
  content: [{ text: "Updated text", bold: true }],
});

updateBlock("block-xyz", {
  props: { language: "typescript" }, // For a code block
});
```

#### `deleteBlock(id)`

Removes a block from the document. If the block has children, those children are promoted to the root level in the same position. History is recorded.

```typescript
deleteBlock("block-abc");
```

#### `toggleMark(mark)`

Toggles an inline formatting mark on the currently selected block's content. If all spans already have the mark, it is removed. Otherwise it is applied to all spans. Supported marks: `'bold'`, `'italic'`, `'underline'`, `'strike'`, `'code'`.

```typescript
toggleMark("bold");
toggleMark("italic");
```

#### `undo()` / `redo()`

Navigates through the history stack. `undo()` restores the previous state, `redo()` moves forward. Both are no-ops at the boundaries of histoy.

```typescript
undo();
redo();
```

## History Model

Every mutating action (`addBlock`, `updateBlock`, `deleteBlock`, `toggleMark`) captures a snapshot of `blocks`, `rootBlocks`, and `selection` before applying the change, and appends it to the `history` array. When `undo()` is called, the editor reverts to the snapshot at `historyIndex`. On `redo()`, it moves forward.

If a new action is performed after undoing, the forward history is discarded (standard undo stack behavior).

## License

MIT
