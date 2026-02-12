import React from 'react';

// Simplified Aeropeak (Formatting Toolbar)
export const Aeropeak: React.FC<{
  position: { x: number, y: number } | null;
  onFormat: (format: string) => void;
}> = ({ position, onFormat }) => {
  if (!position) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: position.y - 40,
        left: position.x,
        zIndex: 1000,
        backgroundColor: '#333',
        color: 'white',
        borderRadius: '4px',
        padding: '4px',
        display: 'flex',
        gap: '4px',
      }}
    >
      <button onClick={() => onFormat('bold')}>B</button>
      <button onClick={() => onFormat('italic')}>I</button>
      <button onClick={() => onFormat('strike')}>S</button>
      <button onClick={() => onFormat('link')}>Link</button>
    </div>
  );
};
