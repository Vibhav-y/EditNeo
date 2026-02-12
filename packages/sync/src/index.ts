import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useEditorStore, NeoBlock } from '@editneo/core';

export class SyncManager {
  doc: Y.Doc;
  yBlocks: Y.Map<NeoBlock>;
  yRoot: Y.Array<string>;
  provider: IndexeddbPersistence;

  constructor(docId: string = 'default') {
    this.doc = new Y.Doc();
    this.yBlocks = this.doc.getMap('blocks');
    this.yRoot = this.doc.getArray('rootBlocks');
    
    // Offline persistence
    this.provider = new IndexeddbPersistence(`editneo-document-${docId}`, this.doc);
    
    this.setupObservers();
    this.syncStoreToYjs(); // Initial sync logic if needed, or rely on observers
  }

  setupObservers() {
    // 1. Listen to Yjs changes and update Zustand
    this.yBlocks.observe((event) => {
      // In a real app, calculate diffs carefully.
      // For MVP, we can just resync the whole state or use the event keys
      console.log('Yjs blocks changed', event.keysChanged);
      
      const newBlocks: Record<string, NeoBlock> = this.yBlocks.toJSON();
      useEditorStore.setState({ blocks: newBlocks });
    });

    this.yRoot.observe((event) => {
        console.log('Yjs root changed');
        const newRoot = this.yRoot.toJSON();
        useEditorStore.setState({ rootBlocks: newRoot });
    });

    // 2. Listen to Zustand changes and update Yjs
    // This is tricky with simple subscriptions as it can cause loops.
    // Better pattern: Action-based updates or specific method hooks.
    // For this plan, we will expose methods to be called by the store actions or middleware.
  }

  // Called when local user adds/updates a block
  onLocalBlockUpdate(block: NeoBlock) {
     if (JSON.stringify(this.yBlocks.get(block.id)) !== JSON.stringify(block)) {
         this.yBlocks.set(block.id, block);
     }
  }

  onLocalBlockDelete(id: string) {
      if (this.yBlocks.has(id)) {
          this.yBlocks.delete(id);
      }
  }
}
