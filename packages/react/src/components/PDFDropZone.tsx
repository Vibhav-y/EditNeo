import React, { useState, useCallback } from 'react';
import { extractBlocksFromPdf } from '@editneo/pdf'; // We'll need to export this or handle worker loading
import { useEditorStore, NeoBlock } from '@editneo/core';
import { useEditor } from '../hooks';

interface PDFDropZoneProps {
  onDrop?: (files: File[]) => void;
  renderOverlay?: (props: { isOver: boolean }) => React.ReactNode;
  children?: React.ReactNode;
}

export const PDFDropZone: React.FC<PDFDropZoneProps> = ({ 
  onDrop, 
  renderOverlay,
  children 
}) => {
  const [isOver, setIsOver] = useState(false);
  const { addBlock } = useEditor();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (onDrop) {
      onDrop(files);
      return; // If custom onDrop is provided, we might not want default behavior? 
      // The guide says "Intercept the file before processing". 
      // User might want to run default logic too. For now let's assume if onDrop is present, user handles it.
      // But actually, usually onDrop is for side effects. 
      // Let's check the guide: "Intercept the file before processing." implies we might stop there.
    }

    // Default processing for PDFs
    const pdfFile = files.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      const buffer = await pdfFile.arrayBuffer();
      // Note: In a real app we'd use a worker. 
      // For this implementation we call the logic directly but wrapped async.
      // We need to ensure @editneo/pdf exports this.
      try {
        const blocks = await extractBlocksFromPdf(buffer);
        blocks.forEach((block: NeoBlock) => {
             // We need a way to add a full block with content, not just type.
             // store.addBlock currently only takes type. 
             // We need to enhance store.addBlock or add a new action `insertBlock` that takes a full block.
             // For now, we'll manually use the internal store update if possible or add the action.
             // Let's assume we update store actions in next steps or just map it.
             
             // Actually, the blocks from PDF are full NeoBlocks.
             // We need `addBlock` to support full block object or a new action `insertFullBlock`.
             // I'll add `insertBlocks` to the store types later.
             // For now, let's log or assume the hook exposes it.
             console.log('PDF Blocks extracted:', blocks);
             // useEditorStore.getState().insertBlocks(blocks); // TODO: Add this action
        });
      } catch (err) {
        console.error('PDF Extraction failed:', err);
      }
    }
  }, [onDrop, addBlock]);

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative', height: '100%', width: '100%' }}
    >
      {children}
      {isOver && (
        <div style={{ 
          position: 'absolute', 
          top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(59, 130, 246, 0.1)', 
          zIndex: 50,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {renderOverlay ? renderOverlay({ isOver }) : (
            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              ✨ Release to Transmute PDF ✨
            </div>
          )}
        </div>
      )}
    </div>
  );
};
