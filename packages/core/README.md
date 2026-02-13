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

The store uses [Zustand](https://zustand-demo.pmnd.rs/) and follows a **per-instance factory pattern**. Each editor creates its own isolated store via `createEditorStore()`, so multiple editors on the same page don't share state. The store is seeded with an initial empty paragraph block.

### Creating a store instance

```typescript
import { createEditorStore } from "@editneo/core";

const store = createEditorStore();
// Each call returns a new, independent store
```

### Accessing state

```typescript
const state = store.getState();
const { blocks, rootBlocks, selection } = state;
```

### Actions

#### `addBlock(type, afterId?)`

Creates a new empty block and inserts it into the document. If `afterId` is provided and exists in `rootBlocks`, the new block is placed immediately after it. Otherwise it is appended to the end. The previous state is pushed onto the undo stack.

```typescript
addBlock("paragraph"); // Appends a paragraph at the end
addBlock("heading-1", "block-abc"); // Inserts a heading after block-abc
```

#### `insertFullBlock(block, afterId?)`

Inserts a complete `NeoBlock` object (e.g. one created by PDF extraction or imported data). Unlike `addBlock`, this accepts a fully formed block rather than just a type.

```typescript
insertFullBlock(myBlock, "block-abc");
```

#### `insertFullBlocks(blocks, afterId?)`

Batch-inserts multiple complete blocks at once.

```typescript
insertFullBlocks(pdfBlocks, "block-abc");
```

#### `updateBlock(id, partial)`

Merges partial data into an existing block. The `updatedAt` timestamp is set automatically. History is debounced — rapid edits to the same block within 300ms are grouped into a single undo step.

```typescript
updateBlock("block-abc", {
  content: [{ text: "Updated text", bold: true }],
});

updateBlock("block-xyz", {
  props: { language: "typescript" }, // For a code block
});
```

#### `deleteBlock(id)`

Removes a block from the document. If the block has children, those children are promoted to the root level in the same position with their `parentId` cleared. History is recorded.

```typescript
deleteBlock("block-abc");
```

#### `moveBlock(id, afterId)`

Moves a block to a new position. If `afterId` is `null`, the block is moved to the beginning.

```typescript
moveBlock("block-abc", "block-xyz"); // Move abc after xyz
moveBlock("block-abc", null); // Move abc to the start
```

#### `setBlockType(id, newType)`

Changes a block's type without altering its content.

```typescript
setBlockType("block-abc", "heading-1");
```

#### `toggleMark(mark)`

Toggles an inline formatting mark on the currently selected range. The mark is applied precisely within the selection's `startOffset`/`endOffset`, splitting spans as needed. Supported marks: `'bold'`, `'italic'`, `'underline'`, `'strike'`, `'code'`.

```typescript
toggleMark("bold");
toggleMark("italic");
```

#### `setLink(url)`

Sets (or removes) a hyperlink on the selected text range. Pass `null` to remove a link.

```typescript
setLink("https://editneo.dev");
setLink(null); // Remove link
```

#### `exportJSON()` / `importJSON(data)`

Serialize and restore the document.

```typescript
const data = exportJSON();
// data: { blocks: Record<string, NeoBlock>, rootBlocks: string[] }

importJSON(data); // Replaces the current document
```

#### `undo()` / `redo()`

Navigates through the history stack. `undo()` restores the previous state, `redo()` moves forward. Both are no-ops at the boundaries of history.

```typescript
undo();
redo();
```

## History Model

Every mutating action captures a snapshot of `blocks`, `rootBlocks`, and `selection` before applying the change. `updateBlock` uses a 300ms debounce window — rapid edits to the same block within that window are grouped into a single undo step, preventing every keystroke from creating a snapshot.

If a new action is performed after undoing, the forward history is discarded (standard undo stack behavior).

## License

MIT
