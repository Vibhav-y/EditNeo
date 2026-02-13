import React, { useContext, useEffect, useState, useCallback } from 'react';
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
    index: number;
  } | null;
}

interface CursorRect {
  top: number;
  left: number;
  height: number;
}

interface CursorOverlayProps {
  colors?: string[];
  renderLabel?: (user: { name: string; color: string }) => React.ReactNode;
}

/**
 * (#25) Calculate the pixel position of a cursor within a contentEditable block.
 * Walks text nodes to find the correct offset, then uses Range.getBoundingClientRect().
 */
function getCursorRect(blockId: string, charIndex: number, containerEl: HTMLElement): CursorRect | null {
  const blockEl = containerEl.querySelector(`[data-block-id="${blockId}"] [contenteditable]`) as HTMLElement;
  if (!blockEl) return null;

  // Walk text nodes to find the correct one
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let targetNode: Text | null = null;
  let targetOffset = 0;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const len = textNode.length;

    if (currentOffset + len >= charIndex) {
      targetNode = textNode;
      targetOffset = charIndex - currentOffset;
      break;
    }
    currentOffset += len;
  }

  if (!targetNode) {
    // Fallback: cursor at end of block
    const rect = blockEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    return {
      top: rect.top - containerRect.top,
      left: rect.right - containerRect.left,
      height: rect.height || 20,
    };
  }

  try {
    const range = document.createRange();
    range.setStart(targetNode, Math.min(targetOffset, targetNode.length));
    range.setEnd(targetNode, Math.min(targetOffset, targetNode.length));
    const rect = range.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();

    return {
      top: rect.top - containerRect.top,
      left: rect.left - containerRect.left,
      height: rect.height || 20,
    };
  } catch {
    return null;
  }
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ 
  renderLabel 
}) => {
  const context = useContext(EditorContext);
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const [cursorRects, setCursorRects] = useState<Map<number, CursorRect>>(new Map());
  const overlayRef = React.useRef<HTMLDivElement>(null);

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

  // Recalculate cursor positions when cursors change
  const updateRects = useCallback(() => {
    const container = overlayRef.current?.parentElement;
    if (!container) return;

    const newRects = new Map<number, CursorRect>();
    for (const cursor of cursors) {
      if (cursor.cursor) {
        const rect = getCursorRect(cursor.cursor.blockId, cursor.cursor.index, container);
        if (rect) {
          newRects.set(cursor.clientId, rect);
        }
      }
    }
    setCursorRects(newRects);
  }, [cursors]);

  useEffect(() => {
    updateRects();
    // Also update on scroll/resize
    const container = overlayRef.current?.parentElement;
    if (!container) return;

    const observer = new MutationObserver(updateRects);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', updateRects);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateRects);
    };
  }, [updateRects]);

  if (!context?.syncManager) return null;

  return (
    <div ref={overlayRef} className="neo-cursor-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999 }}>
      {cursors.map(cursor => {
        const rect = cursorRects.get(cursor.clientId);
        if (!rect || !cursor.cursor) return null;

        return (
          <div 
            key={cursor.clientId}
            style={{
              position: 'absolute',
              top: rect.top,
              left: rect.left,
              transition: 'top 0.1s ease, left 0.1s ease',
            }}
          >
            {/* Cursor line */}
            <div style={{
              width: '2px',
              height: `${rect.height}px`,
              backgroundColor: cursor.user.color,
            }} />
            {/* Label */}
            <div style={{
              position: 'absolute',
              top: -18,
              left: 0,
              backgroundColor: cursor.user.color,
              color: '#fff',
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '3px 3px 3px 0',
              whiteSpace: 'nowrap',
              fontWeight: 500,
              lineHeight: '16px',
            }}>
              {renderLabel ? renderLabel(cursor.user) : cursor.user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};
