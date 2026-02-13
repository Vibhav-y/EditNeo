import React, { useState, useEffect, useContext } from 'react';
import { useStore } from 'zustand';
import { EditorContext } from '../NeoEditor';

export interface CommandItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  execute: (editor: any) => void;
}

interface SlashMenuProps {
  customCommands?: CommandItem[];
  filter?: (cmd: CommandItem) => boolean;
  menuComponent?: React.ComponentType<any>;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({ 
  customCommands = [], 
  filter, 
  menuComponent: MenuComponent 
}) => {
  const context = useContext(EditorContext);
  if (!context) return null;

  const addBlock = useStore(context.store, (s) => s.addBlock);
  const selection = useStore(context.store, (s) => s.selection);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<{ x: number, y: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Default Commands — (#18) pass selection.blockId as afterId
  const defaultCommands: CommandItem[] = [
    { key: 'paragraph', label: 'Paragraph', execute: () => addBlock('paragraph', selection.blockId) },
    { key: 'heading-1', label: 'Heading 1', execute: () => addBlock('heading-1', selection.blockId) },
    { key: 'heading-2', label: 'Heading 2', execute: () => addBlock('heading-2', selection.blockId) },
    { key: 'heading-3', label: 'Heading 3', execute: () => addBlock('heading-3', selection.blockId) },
    { key: 'bullet-list', label: 'Bulleted List', execute: () => addBlock('bullet-list', selection.blockId) },
    { key: 'ordered-list', label: 'Ordered List', execute: () => addBlock('ordered-list', selection.blockId) },
    { key: 'todo-list', label: 'To-do List', execute: () => addBlock('todo-list', selection.blockId) },
    { key: 'quote', label: 'Quote', execute: () => addBlock('quote', selection.blockId) },
    { key: 'code-block', label: 'Code Block', execute: () => addBlock('code-block', selection.blockId) },
    { key: 'divider', label: 'Divider', execute: () => addBlock('divider', selection.blockId) },
    { key: 'callout', label: 'Callout', execute: () => addBlock('callout', selection.blockId) },
    { key: 'image', label: 'Image', execute: () => addBlock('image', selection.blockId) },
  ];

  const allCommands = [...defaultCommands, ...customCommands].filter(cmd => 
    filter ? filter(cmd) : true
  );

  const filteredCommands = allCommands.filter(cmd => 
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // (#17) Detect '/' and preventDefault so it doesn't appear in the block
      if (e.key === '/' && !isOpen) {
        e.preventDefault();
        const sel = window.getSelection?.();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setPosition({ x: rect.left, y: rect.bottom + 5 });
          setIsOpen(true);
          setQuery('');
          setSelectedIndex(0);
        }
      } else if (isOpen) {
        if (e.key === 'Escape') {
          setIsOpen(false);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % Math.max(filteredCommands.length, 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + filteredCommands.length) % Math.max(filteredCommands.length, 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].execute(null);
            setIsOpen(false);
          }
        } else if (e.key === 'Backspace') {
          // (#16) Update query on backspace
          if (query.length > 0) {
            setQuery(q => q.slice(0, -1));
            setSelectedIndex(0);
          } else {
            setIsOpen(false);
          }
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          // (#16) Capture typed characters into query for filtering
          e.preventDefault();
          setQuery(q => q + e.key);
          setSelectedIndex(0);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, query, addBlock, selection.blockId]);

  if (!isOpen || !position) return null;

  if (MenuComponent) {
    return <MenuComponent commands={filteredCommands} position={position} onSelect={(cmd: any) => { cmd.execute(null); setIsOpen(false); }} />;
  }

  return (
    <div
      className="neo-slash-menu"
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 1000,
        backgroundColor: '#ffffff',
        color: '#1f2937',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderRadius: '6px',
        width: '240px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}
    >
      {query && (
        <div style={{ padding: '4px 12px', fontSize: '0.8em', color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>
          Filtering: {query}
        </div>
      )}
      {filteredCommands.map((cmd, index) => (
        <div
          key={cmd.key}
          onClick={() => {
            cmd.execute(null);
            setIsOpen(false);
          }}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            backgroundColor: index === selectedIndex ? '#f3f4f6' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9em'
          }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {cmd.icon && <span className="neo-cmd-icon">{cmd.icon}</span>}
          <span>{cmd.label}</span>
        </div>
      ))}
      {filteredCommands.length === 0 && (
          <div style={{ padding: '8px 12px', color: '#9ca3af', fontSize: '0.9em' }}>No results</div>
      )}
    </div>
  );
};
