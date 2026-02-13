# @editneo/sync

The synchronization layer for EditNeo. This package provides a `SyncManager` class that bridges the Zustand editor store with [Yjs](https://yjs.dev/) CRDTs, giving you offline persistence through IndexedDB and real-time multi-user collaboration through WebSockets — with automatic conflict resolution.

## Installation

```bash
npm install @editneo/sync @editneo/core
```

## How It Works

The `SyncManager` creates a Yjs document and maps the editor's block structure into two Yjs shared types:

- A `Y.Map` for individual blocks (keyed by block ID)
- A `Y.Array` for the ordered list of root block IDs

Changes flow in both directions:

1. **Local to remote:** When the user edits a block through the store, your code calls `syncBlock()` or `syncRoot()` to push the change into the Yjs document. The Yjs providers then propagate it to IndexedDB and to other connected clients.

2. **Remote to local:** When a change arrives from another client (or from IndexedDB on page load), the `SyncManager`'s observers detect the Yjs mutation and update the Zustand store accordingly.

Because Yjs is a CRDT, conflicting edits from multiple users are merged automatically without a central server making decisions.

## Usage

### Basic (offline only)

```typescript
import { SyncManager } from "@editneo/sync";

const sync = new SyncManager("my-document");
// Data is now persisted to IndexedDB under the key "editneo-document-my-document"
```

### With real-time collaboration

```typescript
const sync = new SyncManager("my-document", {
  url: "wss://your-yjs-server.com",
  room: "my-document",
});
```

The `url` should point to a [y-websocket](https://github.com/yjs/y-websocket) server. The `room` determines which document the client joins — clients in the same room share the same Yjs document.

### Syncing local changes

After the store modifies a block, push the change to Yjs:

```typescript
import { useEditorStore } from "@editneo/core";

// After updating a block in the store
const updatedBlock = useEditorStore.getState().blocks["block-123"];
sync.syncBlock(updatedBlock);

// After reordering root blocks
const rootBlocks = useEditorStore.getState().rootBlocks;
sync.syncRoot(rootBlocks);

// After deleting a block
sync.deleteBlock("block-123");
```

These methods include basic deduplication: they compare the incoming data against what Yjs currently holds and skip the write if nothing changed. This prevents trivial feedback loops where a Yjs observer fires a store update, which then tries to write back to Yjs.

### Cursor awareness

When a WebSocket provider is active, you can access the [Yjs Awareness](https://docs.yjs.dev/getting-started/adding-awareness) instance to share cursor positions between users:

```typescript
const awareness = sync.awareness;

if (awareness) {
  // Set local cursor state
  awareness.setLocalStateField("cursor", {
    blockId: "block-abc",
    offset: 12,
    name: "Alice",
    color: "#3b82f6",
  });

  // Listen for remote cursor changes
  awareness.on("change", () => {
    const states = awareness.getStates();
    // states is a Map<clientID, { cursor: { blockId, offset, name, color } }>
  });
}
```

The `CursorOverlay` component from `@editneo/react` consumes this awareness data automatically.

### Cleanup

When the editor unmounts or the document changes, destroy the sync manager to close connections and free resources:

```typescript
sync.destroy();
```

This destroys the IndexedDB provider, the WebSocket provider (if any), and the underlying Yjs document.

## API Reference

### `new SyncManager(docId, syncConfig?)`

| Parameter    | Type                            | Description                                                           |
| ------------ | ------------------------------- | --------------------------------------------------------------------- |
| `docId`      | `string`                        | Unique document identifier. Used to namespace the IndexedDB database. |
| `syncConfig` | `{ url: string; room: string }` | Optional. WebSocket server URL and room name for real-time sync.      |

### Instance Properties

| Property     | Type                             | Description                                        |
| ------------ | -------------------------------- | -------------------------------------------------- |
| `doc`        | `Y.Doc`                          | The underlying Yjs document                        |
| `yBlocks`    | `Y.Map<any>`                     | Yjs map of all blocks                              |
| `yRoot`      | `Y.Array<string>`                | Yjs array of root block IDs                        |
| `provider`   | `IndexeddbPersistence`           | The IndexedDB persistence provider                 |
| `wsProvider` | `WebsocketProvider \| undefined` | The WebSocket provider, if configured              |
| `awareness`  | `Awareness \| undefined`         | The awareness instance from the WebSocket provider |

### Instance Methods

| Method        | Signature                        | Description                                     |
| ------------- | -------------------------------- | ----------------------------------------------- |
| `syncBlock`   | `(block: NeoBlock) => void`      | Pushes a block update to Yjs (with dedup check) |
| `syncRoot`    | `(rootBlocks: string[]) => void` | Replaces the root block ordering in Yjs         |
| `deleteBlock` | `(id: string) => void`           | Removes a block from the Yjs map                |
| `destroy`     | `() => void`                     | Tears down all providers and the Yjs document   |

## Running a WebSocket Server

The simplest way to run a Yjs WebSocket server for development:

```bash
npx y-websocket
```

This starts a server on `ws://localhost:1234`. Point your `syncConfig.url` there:

```typescript
new SyncManager("doc", { url: "ws://localhost:1234", room: "doc" });
```

For production, see the [y-websocket documentation](https://github.com/yjs/y-websocket) for deployment options including authentication, scaling, and persistence.

## License

MIT
