import React, { useState, useEffect, useCallback } from 'react';
import { useEditor } from '../hooks';

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
  const editor = useEditor();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<{ x: number, y: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Default Commands
  const defaultCommands: CommandItem[] = [
    { key: 'paragraph', label: 'Paragraph', execute: (e) => e.addBlock('paragraph') },
    { key: 'heading-1', label: 'Heading 1', execute: (e) => e.addBlock('heading-1') },
    { key: 'heading-2', label: 'Heading 2', execute: (e) => e.addBlock('heading-2') },
    { key: 'heading-3', label: 'Heading 3', execute: (e) => e.addBlock('heading-3') },
    { key: 'bullet-list', label: 'Bulleted List', execute: (e) => e.addBlock('bullet-list') },
    { key: 'ordered-list', label: 'Ordered List', execute: (e) => e.addBlock('ordered-list') },
    { key: 'todo-list', label: 'To-do List', execute: (e) => e.addBlock('todo-list') },
    { key: 'quote', label: 'Quote', execute: (e) => e.addBlock('quote') },
    { key: 'code-block', label: 'Code Block', execute: (e) => e.addBlock('code-block') },
    { key: 'divider', label: 'Divider', execute: (e) => e.addBlock('divider') },
    { key: 'callout', label: 'Callout', execute: (e) => e.addBlock('callout') },
    { key: 'image', label: 'Image', execute: (e) => e.addBlock('image') }, // Needs real upload logic
  ];

  const allCommands = [...defaultCommands, ...customCommands].filter(cmd => 
    filter ? filter(cmd) : true
  );

  const filteredCommands = allCommands.filter(cmd => 
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  // Detect '/' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Very basic detection - in real app, hook into ProseMirror/input events or selection
      // Here we assume if "/" is typed and nothing is selected...
      // This logic is flawed for a real rich text editor without proper input interception
      // Typically the `EditableBlock` handles triggering `onSlash` callback.
      // For this implementation, we will rely on a custom event dispatch or simple global listener 
      // if `useEditor` allowed subscribing to slash events.
      
      // Let's implement a simple listener on the document that checks if active element is our editor
      // This is "good enough" for the demo level. 
      if (e.key === '/' && !isOpen) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              setPosition({ x: rect.left, y: rect.bottom + 5 });
              setIsOpen(true);
              setQuery('');
              setSelectedIndex(0);
              // We don't preventDefault so the '/' is typed, 
              // usually we want to capture it.
          }
      } else if (isOpen) {
          if (e.key === 'Escape') {
              setIsOpen(false);
          } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex(i => (i + 1) % filteredCommands.length);
          } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
          } else if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredCommands[selectedIndex]) {
                  filteredCommands[selectedIndex].execute(editor);
                  setIsOpen(false);
              }
          } else if (e.key === 'Backspace') {
             // Handle query update?
          }
      }
    };

    const handleInput = (e: Event) => {
         if (isOpen) {
             // Update query based on text after slash?
             // Complex to do globally. 
             // Ideally `EditableBlock` passes the query.
         }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, editor]);

  if (!isOpen || !position) return null;

  if (MenuComponent) {
      return <MenuComponent commands={filteredCommands} position={position} onSelect={(cmd: any) => cmd.execute(editor)} />;
  }

  return (
    <div
      className="neo-slash-menu"
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 1000,
        backgroundColor: 'white',
        border: '1px solid #ddd',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderRadius: '6px',
        width: '240px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}
    >
      {filteredCommands.map((cmd, index) => (
        <div
          key={cmd.key}
          onClick={() => {
            cmd.execute(editor);
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
          <div style={{ padding: '8px 12px', color: '#999', fontSize: '0.9em' }}>No results</div>
      )}
    </div>
  );
};
