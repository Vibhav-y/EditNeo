import React, { useRef, useContext } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { NeoBlock } from '@editneo/core';
import { useStore } from 'zustand';
import { EditorContext } from './NeoEditor';
import { BlockRenderer } from './BlockRenderer';

/**
 * (#27a) Compute the sequential order for an ordered-list block.
 * Counts consecutive ordered-list blocks backwards from the given index.
 */
function computeOrder(
  rootBlocks: string[],
  blocks: Record<string, NeoBlock>,
  index: number
): number | undefined {
  const block = blocks[rootBlocks[index]];
  if (!block || block.type !== 'ordered-list') return undefined;

  let order = 1;
  for (let i = index - 1; i >= 0; i--) {
    const prev = blocks[rootBlocks[i]];
    if (!prev || prev.type !== 'ordered-list') break;
    order++;
  }
  return order;
}

export const NeoCanvas: React.FC = () => {
  const context = useContext(EditorContext);

  if (!context) {
    throw new Error('NeoCanvas must be used within a NeoEditor');
  }

  const rootBlocks = useStore(context.store, (state) => state.rootBlocks);
  const blocks = useStore(context.store, (state) => state.blocks);
  const parentRef = useRef<HTMLDivElement>(null);

  /** (#26) Type-aware size estimates for better virtualizer performance */
  const estimateSize = (index: number): number => {
    const blockId = rootBlocks[index];
    const block = blocks[blockId];
    if (!block) return 35;

    switch (block.type) {
      case 'heading-1': return 60;
      case 'heading-2': return 48;
      case 'heading-3': return 40;
      case 'code-block': return 120;
      case 'image':
      case 'video': return 200;
      case 'divider': return 24;
      default: return 35;
    }
  };

  const rowVirtualizer = useVirtualizer({
    count: rootBlocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      style={{
        height: '100%', /* (#24) was 100vh, causing double scrollbar */
        width: '100%',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
          maxWidth: 'var(--neo-content-width, 800px)',
          margin: '0 auto',
          padding: '0 1rem',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const blockId = rootBlocks[virtualRow.index];
          const block = blocks[blockId];

          if (!block) return null;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {/* (#27a) Compute order for ordered-list blocks */}
              <BlockRenderer block={block} order={computeOrder(rootBlocks, blocks, virtualRow.index)} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
