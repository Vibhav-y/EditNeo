import React, { useEffect, useState } from 'react';
import { useEditor } from '../hooks';

interface AeropeakProps {
  children?: React.ReactNode;
  offset?: number;
  animation?: 'fade' | 'scale' | 'none';
}

export const Aeropeak: React.FC<AeropeakProps> & {
  Bold: React.FC;
  Italic: React.FC;
  Strike: React.FC;
  Link: React.FC;
} = ({ children, offset = 10, animation = 'fade' }) => {
  const { selection, toggleMark } = useEditor(); // toggleMark to be implemented in useEditor/store
  const [position, setPosition] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPosition(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Calculate position relative to viewport (fixed positioning usually easiest for portals)
      // or relative to editor container if using absolute.
      // For now, let's use fixed/absolute coordinates based on rect.
      if (rect.width > 0) {
        setPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - offset,
        });
      } else {
        setPosition(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [offset]);

  if (!position) return null;

  return (
    <div
      className={`neo-aeropeak neo-anim-${animation}`}
      style={{
        position: 'fixed', // Using fixed for simplicity with viewport coords
        top: position.y,
        left: position.x,
        transform: 'translate(-50%, -100%)',
        zIndex: 1000,
        backgroundColor: '#333',
        color: 'white',
        borderRadius: '4px',
        padding: '4px',
        display: 'flex',
        gap: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
    >
      {children || (
        <>
          <Aeropeak.Bold />
          <Aeropeak.Italic />
          <Aeropeak.Strike />
          <Aeropeak.Link />
        </>
      )}
    </div>
  );
};

export const AeroButton: React.FC<{
  icon: React.ReactNode;
  label?: string;
  onClick: (editor: any) => void;
}> = ({ icon, label, onClick }) => {
  const editor = useEditor();
  return (
    <button 
      onClick={() => onClick(editor)}
      className="neo-aero-button"
      title={label}
      style={{
        background: 'none',
        border: 'none',
        color: 'inherit',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '2px',
        display: 'flex', alignItems: 'center'
      }}
    >
      {icon}
    </button>
  );
};

export const Separator: React.FC = () => (
    <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
);

// Default Buttons
Aeropeak.Bold = () => <AeroButton icon={<strong>B</strong>} label="Bold" onClick={(e) => e.toggleMark && e.toggleMark('bold')} />;
Aeropeak.Italic = () => <AeroButton icon={<em>I</em>} label="Italic" onClick={(e) => e.toggleMark && e.toggleMark('italic')} />;
Aeropeak.Strike = () => <AeroButton icon={<s>S</s>} label="Strike" onClick={(e) => e.toggleMark && e.toggleMark('strike')} />;
Aeropeak.Link = () => <AeroButton icon={<span>🔗</span>} label="Link" onClick={(e) => e.toggleMark && e.toggleMark('link')} />;
