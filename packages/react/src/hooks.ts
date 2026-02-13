import { useContext } from 'react';
import { useStore } from 'zustand';
import { EditorStore } from '@editneo/core';
import { EditorContext } from './NeoEditor';

/**
 * Primary hook for interacting with the current editor instance.
 * Must be called inside a <NeoEditor />.
 * Returns all store state and actions for the enclosing editor only.
 */
export const useEditor = () => {
  const context = useContext(EditorContext);
  
  if (!context) {
    throw new Error('useEditor must be used within a NeoEditor');
  }

  const store = useStore(context.store);

  return {
    ...store,
    insertBlock: store.addBlock, // Alias for DX
  };
};

/**
 * Focused hook that subscribes only to the selection state,
 * minimizing re-renders in components that don't need the full document.
 */
export const useSelection = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useSelection must be used within a NeoEditor');
  }
  return useStore(context.store, (state: EditorStore) => state.selection);
};

/**
 * Returns the current sync connection status.
 */
export const useSyncStatus = () => {
  const context = useContext(EditorContext);
  return context?.syncManager ? 'connected' : 'disconnected';
};
