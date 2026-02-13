import { createStore } from 'zustand/vanilla';
import { v4 as uuid } from 'uuid';
import { NeoBlock, EditorState, BlockType, Span } from './types';

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a blank block with sensible defaults. */
function makeBlock(type: BlockType, content: Span[] = [], props: Record<string, any> = {}): NeoBlock {
  return {
    id: uuid(),
    type,
    content,
    props,
    children: [],
    parentId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Capture a snapshot of the mutable state fields for undo history. */
function snapshot(state: EditorState) {
  return {
    blocks: state.blocks,
    rootBlocks: state.rootBlocks,
    selection: state.selection,
  };
}

/**
 * Slice spans by character offsets and toggle a mark on the selected range.
 * Returns the new content array with the mark toggled only within [start, end).
 */
function toggleMarkInRange(
  spans: Span[],
  start: number,
  end: number,
  mark: keyof Pick<Span, 'bold' | 'italic' | 'underline' | 'strike' | 'code'>
): Span[] {
  if (spans.length === 0 || start >= end) return spans;

  // Flatten spans into segments with their character ranges
  type SpanRange = { span: Span; from: number; to: number };
  const ranges: SpanRange[] = [];
  let offset = 0;
  for (const span of spans) {
    ranges.push({ span, from: offset, to: offset + span.text.length });
    offset += span.text.length;
  }

  // Clamp selection to content length
  const selStart = Math.max(0, start);
  const selEnd = Math.min(offset, end);

  // If selection covers the entire block, fall back to the old toggle-all behavior
  if (selStart === 0 && selEnd === offset) {
    const allMarked = spans.length > 0 && spans.every((s) => s[mark]);
    return spans.map((s) => ({ ...s, [mark]: !allMarked }));
  }

  // Check if every span within the selection range already has the mark
  const selectedSpans = ranges.filter((r) => r.to > selStart && r.from < selEnd);
  const allMarked = selectedSpans.every((r) => r.span[mark]);
  const newValue = !allMarked;

  // Split and rebuild
  const result: Span[] = [];
  for (const { span, from, to } of ranges) {
    if (to <= selStart || from >= selEnd) {
      // Entirely outside selection — keep as-is
      result.push(span);
    } else if (from >= selStart && to <= selEnd) {
      // Entirely inside selection — toggle
      result.push({ ...span, [mark]: newValue });
    } else {
      // Partially overlaps — split the span
      if (from < selStart) {
        result.push({ ...span, text: span.text.slice(0, selStart - from) });
      }
      const overlapStart = Math.max(from, selStart);
      const overlapEnd = Math.min(to, selEnd);
      result.push({ ...span, text: span.text.slice(overlapStart - from, overlapEnd - from), [mark]: newValue });
      if (to > selEnd) {
        result.push({ ...span, text: span.text.slice(selEnd - from) });
      }
    }
  }

  return result;
}

// ── Actions interface ────────────────────────────────────────────────

export interface EditorActions {
  addBlock: (type: BlockType, afterId?: string | null) => void;
  insertFullBlock: (block: NeoBlock, afterId?: string | null) => void;
  insertFullBlocks: (blocks: NeoBlock[], afterId?: string | null) => void;
  updateBlock: (id: string, partial: Partial<NeoBlock>) => void;
  deleteBlock: (id: string) => void;
  moveBlock: (id: string, afterId: string | null) => void;
  setBlockType: (id: string, newType: BlockType) => void;
  setSelection: (blockId: string | null, startOffset: number, endOffset: number) => void;
  toggleMark: (mark: keyof Pick<Span, 'bold' | 'italic' | 'underline' | 'strike' | 'code'>) => void;
  setLink: (url: string | null) => void;
  undo: () => void;
  redo: () => void;
  exportJSON: () => { blocks: Record<string, NeoBlock>; rootBlocks: string[] };
  importJSON: (data: { blocks: Record<string, NeoBlock>; rootBlocks: string[] }) => void;
}

export type EditorStore = EditorState & EditorActions;

// ── Store factory ────────────────────────────────────────────────────

/**
 * Creates a new, isolated editor store instance.
 * Each NeoEditor should have its own store so multiple editors
 * on the same page don't share state.
 * 
 * The store is seeded with one empty paragraph so the editor
 * is never completely blank.
 */
export function createEditorStore() {
  // Seed with one empty paragraph (#1)
  const initialBlock = makeBlock('paragraph');

  return createStore<EditorStore>((set, get) => ({
    blocks: { [initialBlock.id]: initialBlock },
    rootBlocks: [initialBlock.id],
    selection: {
      blockId: initialBlock.id,
      startOffset: 0,
      endOffset: 0,
    },
    history: [],
    historyIndex: -1,

    // ── History navigation ─────────────────────────────────────────

    undo: () => set((state) => {
      if (state.historyIndex < 0) return state;
      const prev = state.history[state.historyIndex];
      return {
        ...prev,
        historyIndex: state.historyIndex - 1,
        history: state.history,
      };
    }),

    redo: () => set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const next = state.history[state.historyIndex + 1];
      return {
        ...next,
        historyIndex: state.historyIndex + 1,
        history: state.history,
      };
    }),

    // ── Selection ──────────────────────────────────────────────────

    setSelection: (blockId, startOffset, endOffset) =>
      set(() => ({
        selection: { blockId, startOffset, endOffset },
      })),

    // ── Block CRUD ─────────────────────────────────────────────────

    addBlock: (type, afterId = null) =>
      set((state) => {
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), snapshot(state)];
        const newBlock = makeBlock(type);

        const newRootBlocks = [...state.rootBlocks];
        if (afterId && state.rootBlocks.includes(afterId)) {
          const index = newRootBlocks.indexOf(afterId);
          newRootBlocks.splice(index + 1, 0, newBlock.id);
        } else {
          newRootBlocks.push(newBlock.id);
        }

        return {
          blocks: { ...state.blocks, [newBlock.id]: newBlock },
          rootBlocks: newRootBlocks,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          selection: { blockId: newBlock.id, startOffset: 0, endOffset: 0 },
        };
      }),

    /** Insert a complete NeoBlock object (e.g. from PDF extraction). (#2) */
    insertFullBlock: (block, afterId = null) =>
      set((state) => {
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), snapshot(state)];

        const newRootBlocks = [...state.rootBlocks];
        if (afterId && state.rootBlocks.includes(afterId)) {
          const index = newRootBlocks.indexOf(afterId);
          newRootBlocks.splice(index + 1, 0, block.id);
        } else {
          newRootBlocks.push(block.id);
        }

        return {
          blocks: { ...state.blocks, [block.id]: block },
          rootBlocks: newRootBlocks,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          selection: { blockId: block.id, startOffset: 0, endOffset: 0 },
        };
      }),

    /** Insert multiple complete blocks at once (batch insert). */
    insertFullBlocks: (blocks, afterId = null) =>
      set((state) => {
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), snapshot(state)];

        const newBlocks = { ...state.blocks };
        const newRootBlocks = [...state.rootBlocks];
        const insertIndex = afterId && state.rootBlocks.includes(afterId)
          ? newRootBlocks.indexOf(afterId) + 1
          : newRootBlocks.length;

        const ids: string[] = [];
        for (const block of blocks) {
          newBlocks[block.id] = block;
          ids.push(block.id);
        }
        newRootBlocks.splice(insertIndex, 0, ...ids);

        const lastId = ids[ids.length - 1] || null;
        return {
          blocks: newBlocks,
          rootBlocks: newRootBlocks,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          selection: { blockId: lastId, startOffset: 0, endOffset: 0 },
        };
      }),

    updateBlock: (id, partial) => {
      const now = Date.now();
      const DEBOUNCE_MS = 300;

      set((state) => {
        const block = state.blocks[id];
        if (!block) return state;

        // (#5) Debounce: only push history if >300ms since last update to this block,
        // or if a different block is being updated
        const timeSinceLastUpdate = now - (block.updatedAt || 0);
        const shouldPushHistory = timeSinceLastUpdate > DEBOUNCE_MS;

        let newHistory = state.history;
        let newHistoryIndex = state.historyIndex;

        if (shouldPushHistory) {
          newHistory = [...state.history.slice(0, state.historyIndex + 1), snapshot(state)];
          newHistoryIndex = newHistory.length - 1;
        }

        return {
          blocks: {
            ...state.blocks,
            [id]: { ...block, ...partial, updatedAt: now },
          },
          history: newHistory,
          historyIndex: newHistoryIndex,
        };
      });
    },

    /** Delete a block. Children are promoted to root with parentId cleared. (#4) */
    deleteBlock: (id) =>
      set((state) => {
        const block = state.blocks[id];
        if (!block) return state;

        const newHistory = [...state.history.slice(0, state.historyIndex + 1), snapshot(state)];

        const { [id]: _deleted, ...remainingBlocks } = state.blocks;
        const newRootBlocks = state.rootBlocks.filter((blockId) => blockId !== id);

        // Promote children to root and clear their parentId
        if (block.children.length > 0) {
          const index = state.rootBlocks.indexOf(id);
          if (index !== -1) {
            newRootBlocks.splice(index, 0, ...block.children);
          }
          for (const childId of block.children) {
            if (remainingBlocks[childId]) {
              remainingBlocks[childId] = { ...remainingBlocks[childId], parentId: null };
            }
          }
        }

        return {
          blocks: remainingBlocks,
          rootBlocks: newRootBlocks,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    /** Move a block to a new position (after afterId, or to the start if null). (#6) */
    moveBlock: (id, afterId) =>
      set((state) => {
        if (!state.blocks[id]) return state;
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), snapshot(state)];

        const newRootBlocks = state.rootBlocks.filter((bid) => bid !== id);
        if (afterId && newRootBlocks.includes(afterId)) {
          const idx = newRootBlocks.indexOf(afterId);
          newRootBlocks.splice(idx + 1, 0, id);
        } else {
          newRootBlocks.unshift(id);
        }

        return {
          rootBlocks: newRootBlocks,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    /** Change a block's type without losing content. (#6) */
    setBlockType: (id, newType) =>
      set((state) => {
        const block = state.blocks[id];
        if (!block) return state;
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), snapshot(state)];

        return {
          blocks: {
            ...state.blocks,
            [id]: { ...block, type: newType, updatedAt: Date.now() },
          },
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    // ── Inline formatting ──────────────────────────────────────────

    /** Toggle a mark on the selected range only (#3). */
    toggleMark: (mark) =>
      set((state) => {
        const blockId = state.selection.blockId;
        if (!blockId) return state;

        const block = state.blocks[blockId];
        if (!block) return state;

        const { startOffset, endOffset } = state.selection;
        const newContent = toggleMarkInRange(block.content, startOffset, endOffset, mark);

        const newHistory = [...state.history.slice(0, state.historyIndex + 1), snapshot(state)];

        return {
          blocks: {
            ...state.blocks,
            [blockId]: { ...block, content: newContent, updatedAt: Date.now() },
          },
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    /** Set or clear a link on the selected range. (#19 support) */
    setLink: (url) =>
      set((state) => {
        const blockId = state.selection.blockId;
        if (!blockId) return state;

        const block = state.blocks[blockId];
        if (!block || block.content.length === 0) return state;

        const { startOffset, endOffset } = state.selection;
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), snapshot(state)];

        // Apply link to spans in the selection range
        const result: Span[] = [];
        let offset = 0;
        for (const span of block.content) {
          const from = offset;
          const to = offset + span.text.length;
          offset = to;

          if (to <= startOffset || from >= endOffset) {
            result.push(span);
          } else if (from >= startOffset && to <= endOffset) {
            result.push({ ...span, link: url || undefined });
          } else {
            if (from < startOffset) {
              result.push({ ...span, text: span.text.slice(0, startOffset - from) });
            }
            const overlapStart = Math.max(from, startOffset);
            const overlapEnd = Math.min(to, endOffset);
            result.push({ ...span, text: span.text.slice(overlapStart - from, overlapEnd - from), link: url || undefined });
            if (to > endOffset) {
              result.push({ ...span, text: span.text.slice(endOffset - from) });
            }
          }
        }

        return {
          blocks: {
            ...state.blocks,
            [blockId]: { ...block, content: result, updatedAt: Date.now() },
          },
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    // ── Serialization (#45) ────────────────────────────────────────

    exportJSON: () => {
      const state = get();
      return { blocks: state.blocks, rootBlocks: state.rootBlocks };
    },

    importJSON: (data) =>
      set((state) => {
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), snapshot(state)];
        return {
          blocks: data.blocks,
          rootBlocks: data.rootBlocks,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          selection: { blockId: data.rootBlocks[0] || null, startOffset: 0, endOffset: 0 },
        };
      }),
  }));
}

/** The type returned by createEditorStore() */
export type EditorStoreInstance = ReturnType<typeof createEditorStore>;
