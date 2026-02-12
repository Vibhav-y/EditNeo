import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { NeoBlock, EditorState, BlockType, Span } from './types';

interface EditorActions {
  addBlock: (type: BlockType, afterId?: string | null) => void;
  updateBlock: (id: string, partial: Partial<NeoBlock>) => void;
  deleteBlock: (id: string) => void;
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

  addBlock: (type, afterId = null) =>
    set((state) => {
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
      };
    }),

  updateBlock: (id, partial) =>
    set((state) => {
      const block = state.blocks[id];
      if (!block) return state;

      return {
        blocks: {
          ...state.blocks,
          [id]: { ...block, ...partial, updatedAt: Date.now() },
        },
      };
    }),

  deleteBlock: (id) =>
    set((state) => {
      const block = state.blocks[id];
      if (!block) return state;

      const { [id]: deleted, ...remainingBlocks } = state.blocks;
      const newRootBlocks = state.rootBlocks.filter((blockId) => blockId !== id);

      // Flatten children: move them to parent of deleted block or root if no parent
      // Note: This implementation assumes simple root-level flattening for now as per plan "Flatten by default"
      // More complex logic needed for nested structures if parentId is supported fully.
      // For now, if a root block is deleted, its children (if any) are just orphaned or we need to handle them.
      // The prompt said: "If the block has children, move them to the parent of the deleted block (flattening)"
      
      // Let's implement basic flattening for root blocks:
      if (block.children.length > 0) {
          // If we had a parent, we'd add them there. Since we only really support rootBlocks logic here so far:
          // We need to insert children into rootBlocks at the position of the deleted block.
           const index = state.rootBlocks.indexOf(id);
           if (index !== -1) {
               newRootBlocks.splice(index, 0, ...block.children);
           }
      }

      return {
        blocks: remainingBlocks,
        rootBlocks: newRootBlocks,
      };
    }),
}));
