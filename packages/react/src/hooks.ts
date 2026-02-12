import { useContext } from 'react';
import { useEditorStore } from '@editneo/core';
import { EditorContext } from './NeoEditor';

export const useEditor = () => {
  const store = useEditorStore();
  const context = useContext(EditorContext);
  
  if (!context) {
    throw new Error('useEditor must be used within a NeoEditor');
  }

  return {
    ...store,
    // Add specific editor methods here that might combine store + sync
    insertBlock: store.addBlock, // Alias for DX
    // exportJSON implementation would go here
  };
};

export const useSelection = () => {
  return useEditorStore((state) => state.selection);
};

export const useSyncStatus = () => {
  const context = useContext(EditorContext);
  // Placeholder - needs SyncManager to expose status observable
  return context?.syncManager ? 'connected' : 'disconnected';
};
