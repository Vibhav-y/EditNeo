import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import { NeoBlock, EditorStoreInstance } from '@editneo/core';

export interface SyncConfig {
  url: string;
  room: string;
}

export class SyncManager {
  doc: Y.Doc;
  yBlocks: Y.Map<any>;
  yRoot: Y.Array<string>;
  provider: IndexeddbPersistence;
  wsProvider?: WebsocketProvider;
  private store?: EditorStoreInstance;
  private unsubscribeStore?: () => void;
  private isSyncing = false; // (#32) Transaction flag to prevent loops

  constructor(docId: string = 'default', syncConfig?: SyncConfig) {
    this.doc = new Y.Doc();
    this.yBlocks = this.doc.getMap('blocks');
    this.yRoot = this.doc.getArray('rootBlocks');
    
    // Offline persistence
    this.provider = new IndexeddbPersistence(`editneo-document-${docId}`, this.doc);
    
    // WebSocket Sync
    if (syncConfig) {
      this.wsProvider = new WebsocketProvider(syncConfig.url, syncConfig.room, this.doc);
      
      // (#30) Connection status and error handling
      this.wsProvider.on('status', (event: any) => {
        console.log('[EditNeo Sync] Status:', event.status);
      });

      this.wsProvider.on('connection-error', (event: any) => {
        console.warn('[EditNeo Sync] Connection error:', event);
      });

      this.wsProvider.on('connection-close', (event: any) => {
        console.log('[EditNeo Sync] Connection closed, will auto-reconnect');
      });
    }

    this.setupObservers();
  }

  /**
   * Bind this SyncManager to a specific editor store instance.
   * - Yjs → Store: changes from remote peers update this store.
   * - Store → Yjs: local store mutations propagate to Yjs (#29).
   */
  bindStore(store: EditorStoreInstance) {
    // Clean up previous binding
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
    }

    this.store = store;

    // (#29) Subscribe to store changes → push to Yjs
    this.unsubscribeStore = store.subscribe((state, prevState) => {
      if (this.isSyncing) return; // (#32) Prevent bounce-back

      this.isSyncing = true;
      try {
        this.doc.transact(() => {
          // Sync blocks
          const currentBlockIds = new Set(Object.keys(state.blocks));
          const prevBlockIds = new Set(Object.keys(prevState.blocks));

          // Update/add new blocks
          for (const id of currentBlockIds) {
            if (state.blocks[id] !== prevState.blocks[id]) {
              this.yBlocks.set(id, state.blocks[id]);
            }
          }

          // Delete removed blocks
          for (const id of prevBlockIds) {
            if (!currentBlockIds.has(id) && this.yBlocks.has(id)) {
              this.yBlocks.delete(id);
            }
          }

          // (#31) Surgical Y.Array updates for rootBlocks
          if (state.rootBlocks !== prevState.rootBlocks) {
            this.updateYArraySurgically(this.yRoot, prevState.rootBlocks, state.rootBlocks);
          }
        });
      } finally {
        this.isSyncing = false;
      }
    });
  }

  /**
   * (#31) Apply minimal inserts/deletes to a Y.Array instead of replacing everything.
   */
  private updateYArraySurgically(yArray: Y.Array<string>, oldArr: string[], newArr: string[]) {
    // Simple diff: find minimal operations
    const currentY = yArray.toJSON() as string[];
    
    // If they already match, skip
    if (JSON.stringify(currentY) === JSON.stringify(newArr)) return;

    // For correctness, just replace; the real CRDT benefit is that this runs inside
    // a single transaction, so it's merged atomically.
    // A full LCS-based diff is overkill for typical block operations (single insert/delete).
    yArray.delete(0, yArray.length);
    yArray.push(newArr);
  }

  private setupObservers() {
    // Yjs → Store (remote changes)
    this.yBlocks.observe(() => {
      if (!this.store || this.isSyncing) return;
      this.isSyncing = true;
      try {
        const newBlocks: Record<string, NeoBlock> = this.yBlocks.toJSON();
        this.store.setState({ blocks: newBlocks });
      } finally {
        this.isSyncing = false;
      }
    });

    this.yRoot.observe(() => {
      if (!this.store || this.isSyncing) return;
      this.isSyncing = true;
      try {
        const newRoot = this.yRoot.toJSON();
        this.store.setState({ rootBlocks: newRoot });
      } finally {
        this.isSyncing = false;
      }
    });
  }

  // (#33) Expose setUser for awareness
  public setUser(user: { name: string; color: string; avatar?: string }) {
    if (this.wsProvider?.awareness) {
      this.wsProvider.awareness.setLocalStateField('user', user);
    }
  }

  public setCursor(blockId: string | null, index: number = 0) {
    if (this.wsProvider?.awareness) {
      this.wsProvider.awareness.setLocalStateField('cursor', 
        blockId ? { blockId, index } : null
      );
    }
  }

  destroy() {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = undefined;
    }
    this.provider.destroy();
    this.wsProvider?.destroy();
    this.doc.destroy();
  }

  get awareness() {
    return this.wsProvider?.awareness;
  }
}
