import React, { useState, useEffect } from 'react';

// Simplified Slash Menu - in real app would use @floating-ui/react
export const SlashMenu: React.FC<{
  position: { x: number, y: number } | null;
  onSelect: (type: string) => void;
  onClose: () => void;
}> = ({ position, onSelect, onClose }) => {
  if (!position) return null;

  const items = [
    { label: 'Paragraph', type: 'paragraph' },
    { label: 'Heading 1', type: 'heading-1' },
    { label: 'Heading 2', type: 'heading-2' },
    { label: 'Bulleted List', type: 'bullet-list' },
    { label: 'Ordered List', type: 'ordered-list' },
    { label: 'To-do List', type: 'todo-list' },
    { label: 'Quote', type: 'quote' },
    { label: 'Code Block', type: 'code-block' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        zIndex: 1000,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        borderRadius: '4px',
        padding: '4px 0',
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.type}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            hover: { backgroundColor: '#f0f0f0' } // Inline hover not supported, mock style
          }}
          onClick={() => {
            onSelect(item.type);
            onClose();
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
};
