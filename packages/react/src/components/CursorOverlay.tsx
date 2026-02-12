import React, { useContext, useEffect, useState } from 'react';
import { EditorContext } from '../NeoEditor';

interface Cursor {
  clientId: number;
  user: {
    name: string;
    color: string;
    avatar?: string;
  };
  cursor: {
    blockId: string;
    index: number; // offset in block
  } | null;
}

interface CursorOverlayProps {
  colors?: string[];
  renderLabel?: (user: any) => React.ReactNode;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ 
  colors = ['#FF5733', '#33FF57', '#3357FF'],
  renderLabel 
}) => {
  const context = useContext(EditorContext);
  const [cursors, setCursors] = useState<Cursor[]>([]);

  useEffect(() => {
    const manager = context?.syncManager;
    if (!manager || !manager.awareness) return;

    const awareness = manager.awareness;

    const handleChange = () => {
      const states = awareness.getStates();
      const newCursors: Cursor[] = [];
      states.forEach((state: any, clientId: number) => {
        if (clientId !== awareness.clientID && state.user && state.cursor) {
          newCursors.push({
            clientId,
            user: state.user,
            cursor: state.cursor
          });
        }
      });
      setCursors(newCursors);
    };

    awareness.on('change', handleChange);
    return () => {
      awareness.off('change', handleChange);
    };
  }, [context?.syncManager]);

  if (!context?.syncManager) return null;

  return (
    <div className="neo-cursor-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999 }}>
      {cursors.map(cursor => (
        <div 
          key={cursor.clientId}
          style={{
             // Positioning logic would go here based on cursor.cursor props (blockId, index)
             // For MVP we just render a dummy marker at top left or log it
             // Real implementation requires integration effectively with EditableBlock measurements
             position: 'absolute',
             display: 'none' // Hidden for now as we lack rect calculation
          }}
        >
          <span style={{ backgroundColor: cursor.user.color }}>{cursor.user.name}</span>
        </div>
      ))}
    </div>
  );
};
