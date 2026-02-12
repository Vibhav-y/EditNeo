import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEditorStore } from '@editneo/core';
import { EditableBlock } from './EditableBlock';

export const NeoCanvas: React.FC = () => {
  const rootBlocks = useEditorStore((state) => state.rootBlocks);
  const blocks = useEditorStore((state) => state.blocks);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rootBlocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // Estimate row height
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      style={{
        height: '100vh',
        width: '100%',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
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
              <EditableBlock block={block} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
