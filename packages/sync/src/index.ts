import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import { useEditorStore, NeoBlock } from '@editneo/core';

export class SyncManager {
  doc: Y.Doc;
  yBlocks: Y.Map<any>; // yjs map stores plain objects, not strictly NeoBlock typed inside
  yRoot: Y.Array<string>;
  provider: IndexeddbPersistence;
  wsProvider?: WebsocketProvider;

  constructor(docId: string = 'default', syncConfig?: { url: string; room: string }) {
    this.doc = new Y.Doc();
    this.yBlocks = this.doc.getMap('blocks');
    this.yRoot = this.doc.getArray('rootBlocks');
    
    // Offline persistence
    this.provider = new IndexeddbPersistence(`editneo-document-${docId}`, this.doc);
    
    // WebSocket Sync
    if (syncConfig) {
      this.wsProvider = new WebsocketProvider(syncConfig.url, syncConfig.room, this.doc);
      
      this.wsProvider.on('status', (event: any) => {
        console.log('Sync status:', event.status); // 'connected' or 'disconnected'
      });
    }

    this.setupObservers();
  }

  setupObservers() {
    // 1. Listen to Yjs changes and update Zustand
    this.yBlocks.observe((event) => {
      // Simplistic full sync for now (MVP optimization needed later)
      const newBlocks: Record<string, NeoBlock> = this.yBlocks.toJSON();
      useEditorStore.setState({ blocks: newBlocks });
    });

    this.yRoot.observe((event) => {
        const newRoot = this.yRoot.toJSON();
        useEditorStore.setState({ rootBlocks: newRoot });
    });
    
    // Subscribe to store changes to push to Yjs?
    // Doing it inside store via middleware is better to avoid loops.
    // OR expose a method here that the store calls.
  }
  
  // These methods should be called by the store actions
  public syncBlock(block: NeoBlock) {
      // Only update if changed prevents some loops, but Yjs handles identical updates well.
      // We should check if the update is coming from Yjs (remote) or local.
      // Since we are calling this from store actions, it's local.
      // However, store actions might be triggered by Yjs updates -> loop risk!
      // We need a flag or compare content.
      
      const currentYBlock = this.yBlocks.get(block.id);
      if (JSON.stringify(currentYBlock) !== JSON.stringify(block)) {
          // Improve: granular updates
          this.yBlocks.set(block.id, block);
      }
  }
  
  public syncRoot(rootBlocks: string[]) {
      const currentYRoot = this.yRoot.toJSON();
      if (JSON.stringify(currentYRoot) !== JSON.stringify(rootBlocks)) {
          this.doc.transact(() => {
              this.yRoot.delete(0, this.yRoot.length);
              this.yRoot.push(rootBlocks);
          });
      }
  }
  
  public deleteBlock(id: string) {
      if (this.yBlocks.has(id)) {
          this.yBlocks.delete(id);
      }
  }

  destroy() {
      this.provider.destroy();
      this.wsProvider?.destroy();
      this.doc.destroy();
  }

  get awareness() {
      return this.wsProvider?.awareness;
  }
}
