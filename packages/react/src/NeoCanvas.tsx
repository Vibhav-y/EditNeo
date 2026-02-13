import React, { useRef, useContext } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from 'zustand';
import { EditorContext } from './NeoEditor';
import { BlockRenderer } from './BlockRenderer';

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
              {/* (#10) Route through BlockRenderer instead of EditableBlock directly */}
              <BlockRenderer block={block} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
