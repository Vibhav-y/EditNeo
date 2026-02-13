import React, { useEffect, useState, useContext } from 'react';
import { useStore } from 'zustand';
import { EditorContext } from '../NeoEditor';

interface AeropeakProps {
  children?: React.ReactNode;
  offset?: number;
  animation?: 'fade' | 'scale' | 'none';
}

export const Aeropeak: React.FC<AeropeakProps> & {
  Bold: React.FC;
  Italic: React.FC;
  Underline: React.FC;
  Strike: React.FC;
  Code: React.FC;
  Link: React.FC;
} = ({ children, offset = 10, animation = 'fade' }) => {
  const [position, setPosition] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    // (#44) SSR guard
    if (typeof window === 'undefined') return;

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPosition(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
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
        position: 'fixed',
        top: position.y,
        left: position.x,
        transform: 'translate(-50%, -100%)',
        zIndex: 1000,
        backgroundColor: '#1f2937',
        color: '#ffffff',
        borderRadius: '6px',
        padding: '4px',
        display: 'flex',
        gap: '2px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
    >
      {children || (
        <>
          <Aeropeak.Bold />
          <Aeropeak.Italic />
          <Aeropeak.Underline />
          <Aeropeak.Strike />
          <Aeropeak.Code />
          <Aeropeak.Link />
        </>
      )}
    </div>
  );
};

export const AeroButton: React.FC<{
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="neo-aero-button"
      title={label}
      style={{
        background: 'none',
        border: 'none',
        color: 'inherit',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        fontSize: '14px',
      }}
      onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
      onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {icon}
    </button>
  );
};

export const Separator: React.FC = () => (
    <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
);

/** Helper component that connects to context store */
function MarkButton({ mark, icon, label }: { mark: 'bold' | 'italic' | 'underline' | 'strike' | 'code'; icon: React.ReactNode; label: string }) {
  const context = useContext(EditorContext);
  const toggleMark = context ? useStore(context.store, (s) => s.toggleMark) : null;
  return <AeroButton icon={icon} label={label} onClick={() => toggleMark?.(mark)} />;
}

// (#28) Added Underline and Code buttons
Aeropeak.Bold = () => <MarkButton mark="bold" icon={<strong>B</strong>} label="Bold" />;
Aeropeak.Italic = () => <MarkButton mark="italic" icon={<em>I</em>} label="Italic" />;
Aeropeak.Underline = () => <MarkButton mark="underline" icon={<u>U</u>} label="Underline" />;
Aeropeak.Strike = () => <MarkButton mark="strike" icon={<s>S</s>} label="Strikethrough" />;
Aeropeak.Code = () => <MarkButton mark="code" icon={<span style={{ fontFamily: 'monospace' }}>&lt;/&gt;</span>} label="Code" />;

// (#19) Link button prompts for URL and calls setLink
Aeropeak.Link = () => {
  const context = useContext(EditorContext);
  const setLink = context ? useStore(context.store, (s) => s.setLink) : null;

  const handleClick = () => {
    if (!setLink) return;
    const url = prompt('Enter URL:');
    if (url !== null) {
      setLink(url || null);
    }
  };

  return <AeroButton icon={<span style={{ fontSize: '12px' }}>Link</span>} label="Link" onClick={handleClick} />;
};
