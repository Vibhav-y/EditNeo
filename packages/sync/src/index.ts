import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import { NeoBlock, EditorStoreInstance } from '@editneo/core';

export interface SyncConfig {
  url: string;
  room: string;
}

export type SyncStatus = 'connecting' | 'connected' | 'disconnected';

export class SyncManager {
  doc: Y.Doc;
  yBlocks: Y.Map<any>;
  yRoot: Y.Array<string>;
  provider: IndexeddbPersistence;
  wsProvider?: WebsocketProvider;
  private store?: EditorStoreInstance;
  private unsubscribeStore?: () => void;
  private isSyncing = false; // (#32) Transaction flag to prevent loops
  private _status: SyncStatus = 'disconnected';
  private _statusListeners: Array<(status: SyncStatus) => void> = [];

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
      this._status = 'connecting';
      this.wsProvider.on('status', (event: any) => {
        const newStatus: SyncStatus = event.status === 'connected' ? 'connected' : 'disconnected';
        this._status = newStatus;
        this._statusListeners.forEach(fn => fn(newStatus));
        console.log('[EditNeo Sync] Status:', event.status);
      });

      this.wsProvider.on('connection-error', (event: any) => {
        this._status = 'disconnected';
        this._statusListeners.forEach(fn => fn('disconnected'));
        console.warn('[EditNeo Sync] Connection error:', event);
      });

      this.wsProvider.on('connection-close', (_event: any) => {
        this._status = 'connecting'; // will auto-reconnect
        this._statusListeners.forEach(fn => fn('connecting'));
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
   * Uses a simple forward diff — handles most common operations (single insert, delete, move)
   * with targeted Y.Array mutations to preserve CRDT history.
   */
  private updateYArraySurgically(yArray: Y.Array<string>, _oldArr: string[], newArr: string[]) {
    const currentY = yArray.toJSON() as string[];
    
    // If they already match, skip
    if (JSON.stringify(currentY) === JSON.stringify(newArr)) return;

    // Build a simple LCS-based diff
    const m = currentY.length;
    const n = newArr.length;

    // LCS table
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = currentY[i - 1] === newArr[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    // Backtrack to find operations
    const ops: Array<{ type: 'keep' | 'delete' | 'insert'; value: string }> = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && currentY[i - 1] === newArr[j - 1]) {
        ops.unshift({ type: 'keep', value: currentY[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.unshift({ type: 'insert', value: newArr[j - 1] });
        j--;
      } else {
        ops.unshift({ type: 'delete', value: currentY[i - 1] });
        i--;
      }
    }

    // Apply operations to Y.Array with positional tracking
    let pos = 0;
    for (const op of ops) {
      if (op.type === 'keep') {
        pos++;
      } else if (op.type === 'delete') {
        yArray.delete(pos, 1);
      } else if (op.type === 'insert') {
        yArray.insert(pos, [op.value]);
        pos++;
      }
    }
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

  /** Get the current sync connection status. */
  getStatus(): SyncStatus {
    return this._status;
  }

  /** Register a listener for connection status changes. Returns unsubscribe function. */
  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this._statusListeners.push(listener);
    return () => {
      this._statusListeners = this._statusListeners.filter(fn => fn !== listener);
    };
  }
}
