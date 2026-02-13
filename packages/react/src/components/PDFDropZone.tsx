import React, { useState, useCallback, useContext } from 'react';
import { NeoBlock } from '@editneo/core';
import { useStore } from 'zustand';
import { EditorContext } from '../NeoEditor';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const context = useContext(EditorContext);

  const insertFullBlocks = context ? useStore(context.store, (s) => s.insertFullBlocks) : null;

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
      return;
    }

    // Default processing for PDFs (#11)
    const pdfFile = files.find(f => f.type === 'application/pdf');
    if (pdfFile && insertFullBlocks) {
      setIsProcessing(true);
      try {
        // Lazy-import @editneo/pdf so it's not a hard requirement
        const { extractBlocksFromPdf } = await import('@editneo/pdf');
        const buffer = await pdfFile.arrayBuffer();
        const blocks = await extractBlocksFromPdf(buffer);
        insertFullBlocks(blocks);
      } catch (err) {
        console.error('PDF extraction failed:', err);
      } finally {
        setIsProcessing(false);
      }
    }
  }, [onDrop, insertFullBlocks]);

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative', height: '100%', width: '100%' }}
    >
      {children}
      {(isOver || isProcessing) && (
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
              backgroundColor: 'var(--neo-bg-canvas, white)', 
              color: 'var(--neo-text-primary, #111)',
              padding: '20px', 
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              {isProcessing ? 'Processing PDF...' : 'Drop PDF to convert to blocks'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
