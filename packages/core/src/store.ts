import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { NeoBlock, EditorState, BlockType, Span } from './types';

interface EditorActions {
  addBlock: (type: BlockType, afterId?: string | null) => void;
  updateBlock: (id: string, partial: Partial<NeoBlock>) => void;
  deleteBlock: (id: string) => void;
  toggleMark: (mark: keyof Pick<Span, 'bold' | 'italic' | 'underline' | 'strike' | 'code'>) => void;
  undo: () => void;
  redo: () => void;
}

type EditorStore = EditorState & EditorActions;

export const useEditorStore = create<EditorStore>((set) => ({
  blocks: {},
  rootBlocks: [],
  selection: {
    blockId: null,
    startOffset: 0,
    endOffset: 0,
  },
  history: [],
  historyIndex: -1,

  undo: () => set((state) => {
    if (state.historyIndex < 0) return state;
    const prev = state.history[state.historyIndex];
    return {
      ...prev,
      historyIndex: state.historyIndex - 1,
      history: state.history, // Preserve history
    };
  }),

  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state;
    const next = state.history[state.historyIndex + 1];
    return {
      ...next,
      historyIndex: state.historyIndex + 1,
      history: state.history, // Preserve history
    };
  }),

  // Helper to push state to history
  // Note: specific actions should call this before mutating
  // For simplicity in this MVP, we might wrap setters or just manually push in actions
  
  addBlock: (type, afterId = null) =>
    set((state) => {
      // Push current state to history before change
      const historyEntry = { 
        blocks: state.blocks, 
        rootBlocks: state.rootBlocks, 
        selection: state.selection 
      };
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyEntry];

      const newId = uuid();
      const newBlock: NeoBlock = {
        id: newId,
        type,
        content: [],
        props: {},
        children: [],
        parentId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const newRootBlocks = [...state.rootBlocks];
      if (afterId && state.rootBlocks.includes(afterId)) {
        const index = newRootBlocks.indexOf(afterId);
        newRootBlocks.splice(index + 1, 0, newId);
      } else {
        newRootBlocks.push(newId);
      }

      return {
        blocks: { ...state.blocks, [newId]: newBlock },
        rootBlocks: newRootBlocks,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        selection: { blockId: newId, startOffset: 0, endOffset: 0 }
      };
    }),

  updateBlock: (id, partial) =>
    set((state) => {
      const block = state.blocks[id];
      if (!block) return state;

      // naive history push for every update (might need debouncing for text)
      const historyEntry = { 
        blocks: state.blocks, 
        rootBlocks: state.rootBlocks, 
        selection: state.selection 
      };
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyEntry];

      return {
        blocks: {
          ...state.blocks,
          [id]: { ...block, ...partial, updatedAt: Date.now() },
        },
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
    }),

  deleteBlock: (id) =>
    set((state) => {
      const block = state.blocks[id];
      if (!block) return state;
      
      const historyEntry = { 
        blocks: state.blocks, 
        rootBlocks: state.rootBlocks, 
        selection: state.selection 
      };
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyEntry];

      const { [id]: deleted, ...remainingBlocks } = state.blocks;
      const newRootBlocks = state.rootBlocks.filter((blockId) => blockId !== id);

      if (block.children.length > 0) {
           const index = state.rootBlocks.indexOf(id);
           if (index !== -1) {
               newRootBlocks.splice(index, 0, ...block.children);
           }
      }

      return {
        blocks: remainingBlocks,
        rootBlocks: newRootBlocks,
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
    }),

  toggleMark: (mark) =>
    set((state) => {
      const blockId = state.selection.blockId;
      if (!blockId) return state;

      const block = state.blocks[blockId];
      if (!block) return state;

      // Determine if the mark is currently active on all spans in the selection range
      const allMarked = block.content.length > 0 && block.content.every((span) => span[mark]);

      const newContent: Span[] = block.content.map((span) => ({
        ...span,
        [mark]: !allMarked,
      }));

      const historyEntry = {
        blocks: state.blocks,
        rootBlocks: state.rootBlocks,
        selection: state.selection,
      };
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyEntry];

      return {
        blocks: {
          ...state.blocks,
          [blockId]: { ...block, content: newContent, updatedAt: Date.now() },
        },
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),
}));
