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

Changes flow **bidirectionally** and automatically:

1. **Store → Yjs:** When you mutate the editor store, the `SyncManager` detects the change via Zustand's `subscribe()` and pushes it to Yjs. Only changed blocks are synced, and deletions are tracked. The Yjs providers then propagate changes to IndexedDB and to other connected clients.

2. **Yjs → Store:** When a change arrives from another client (or from IndexedDB on page load), the `SyncManager`'s observers detect the Yjs mutation and update the Zustand store.

An `isSyncing` flag prevents infinite loops between the two directions. All updates are wrapped in Yjs transactions for atomicity.

Because Yjs is a CRDT, conflicting edits from multiple users are merged automatically without a central server making decisions.

## Usage

### Standalone (offline only)

```typescript
import { SyncManager } from "@editneo/sync";
import { createEditorStore } from "@editneo/core";

const store = createEditorStore();
const sync = new SyncManager("my-document");
sync.bindStore(store);
// Data is now persisted to IndexedDB under "editneo-document-my-document"
```

### With real-time collaboration

```typescript
const sync = new SyncManager("my-document", {
  url: "wss://your-yjs-server.com",
  room: "my-document",
});
sync.bindStore(store);
```

The `url` should point to a [y-websocket](https://github.com/yjs/y-websocket) server. The `room` determines which document the client joins — clients in the same room share the same Yjs document.

### With `<NeoEditor />` (recommended)

When used with `@editneo/react`, the `NeoEditor` component creates and binds the `SyncManager` automatically when you pass `syncConfig`:

```tsx
<NeoEditor
  id="shared-doc"
  syncConfig={{ url: "wss://your-server.com", room: "shared-doc" }}
>
  <CursorOverlay />
</NeoEditor>
```

### Cursor awareness

Share cursor positions and user info between collaborators:

```typescript
// Set your user info
sync.setUser({
  name: "Alice",
  color: "#3b82f6",
  avatar: "https://example.com/alice.jpg", // optional
});

// Update cursor position
sync.setCursor("block-abc", 12); // blockId, character index
sync.setCursor(null); // Clear cursor (e.g. on blur)

// Listen for remote cursor changes
const awareness = sync.awareness;
awareness?.on("change", () => {
  const states = awareness.getStates();
  // Map<clientID, { user: { name, color }, cursor: { blockId, index } }>
});
```

The `CursorOverlay` component from `@editneo/react` consumes this awareness data automatically.

### Error handling

The `SyncManager` listens for connection events and logs status changes:

- `status` — connection state changes (connecting, connected, disconnected)
- `connection-error` — WebSocket errors
- `connection-close` — connection closed (auto-reconnect is handled by y-websocket)

### Cleanup

When the editor unmounts or the document changes, destroy the sync manager:

```typescript
sync.destroy();
```

This unsubscribes from the store, destroys the IndexedDB provider, the WebSocket provider (if any), and the underlying Yjs document.

## API Reference

### `new SyncManager(docId, syncConfig?)`

| Parameter    | Type                            | Description                                                           |
| ------------ | ------------------------------- | --------------------------------------------------------------------- |
| `docId`      | `string`                        | Unique document identifier. Used to namespace the IndexedDB database. |
| `syncConfig` | `{ url: string; room: string }` | Optional. WebSocket server URL and room name for real-time sync.      |

### Instance Methods

| Method      | Signature                                                          | Description                                        |
| ----------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| `bindStore` | `(store: EditorStoreInstance) => void`                             | Binds the sync manager to an editor store instance |
| `setUser`   | `(user: { name: string; color: string; avatar?: string }) => void` | Sets local user awareness info                     |
| `setCursor` | `(blockId: string \| null, index?: number) => void`                | Updates local cursor position in awareness         |
| `destroy`   | `() => void`                                                       | Tears down all providers and the Yjs document      |

### Instance Properties

| Property     | Type                             | Description                                        |
| ------------ | -------------------------------- | -------------------------------------------------- |
| `doc`        | `Y.Doc`                          | The underlying Yjs document                        |
| `yBlocks`    | `Y.Map<any>`                     | Yjs map of all blocks                              |
| `yRoot`      | `Y.Array<string>`                | Yjs array of root block IDs                        |
| `provider`   | `IndexeddbPersistence`           | The IndexedDB persistence provider                 |
| `wsProvider` | `WebsocketProvider \| undefined` | The WebSocket provider, if configured              |
| `awareness`  | `Awareness \| undefined`         | The awareness instance from the WebSocket provider |

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
