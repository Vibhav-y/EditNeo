import React, { useRef, useEffect } from 'react';
import { NeoBlock, useEditorStore } from '@editneo/core';

interface EditableBlockProps {
  block: NeoBlock;
  autoFocus?: boolean;
}

export const EditableBlock: React.FC<EditableBlockProps> = ({ block, autoFocus }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const updateBlock = useEditorStore((state) => state.updateBlock);
  const addBlock = useEditorStore((state) => state.addBlock);
  const deleteBlock = useEditorStore((state) => state.deleteBlock);

  useEffect(() => {
    if (autoFocus && contentRef.current) {
      contentRef.current.focus();
    }
  }, [autoFocus]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText;
    // Simple text update for now, Span parsing to be added later
    updateBlock(block.id, { content: [{ text }] });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBlock('paragraph', block.id);
    } else if (e.key === 'Backspace' && contentRef.current?.innerText === '') {
      e.preventDefault();
      deleteBlock(block.id);
    } else if (e.key === '/') {
       // Slash menu trigger logic (placeholder)
    }
  };

  return (
    <div
      ref={contentRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      style={{
        minHeight: '24px',
        outline: 'none',
        padding: '4px 0',
        // Basic styling based on type
        fontSize: block.type === 'heading-1' ? '2em' : '1em',
        fontWeight: block.type.startsWith('heading') ? 'bold' : 'normal',
      }}
    >
      {block.content.map(s => s.text).join('')}
    </div>
  );
};
