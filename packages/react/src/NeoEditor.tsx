import React, { createContext, useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '@editneo/core';
import { SyncManager } from '@editneo/sync';
import { NeoCanvas } from './NeoCanvas';
import './styles.css';

export interface NeoEditorProps {
  id: string; // Document ID
  offline?: boolean;
  syncConfig?: {
    url: string;
    room: string;
  };
  renderBlock?: (block: any, defaultRender: any) => React.ReactNode;
  className?: string;
  theme?: {
    mode: 'light' | 'dark';
    // Allow overriding variables directly if needed
    [key: string]: any;
  };
  children?: React.ReactNode;
}

export const EditorContext = createContext<{
  editorId: string;
  syncManager: SyncManager | null;
  renderBlock?: (block: any, defaultRender: any) => React.ReactNode;
} | null>(null);

export const NeoEditor: React.FC<NeoEditorProps> = ({
  id,
  offline = true,
  syncConfig,
  renderBlock,
  className,
  theme,
  children
}) => {
  const [syncManager, setSyncManager] = useState<SyncManager | null>(null);

  // Initialize Sync Manager
  useEffect(() => {
    const manager = new SyncManager(id);
    // TODO: Configure websocket if syncConfig is present (will be added to SyncManager later)
    setSyncManager(manager);
    
    return () => {
      // manager.destroy(); // Implement destroy in SyncManager
    };
  }, [id, syncConfig]);

  // Apply Theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme?.mode === 'dark') {
      root.style.setProperty('--neo-bg-canvas', '#0f172a');
      root.style.setProperty('--neo-text-primary', '#f3f4f6');
    } else {
      root.style.setProperty('--neo-bg-canvas', '#ffffff');
      root.style.setProperty('--neo-text-primary', '#111827');
    }
  }, [theme]);

  const value = useMemo(() => ({
    editorId: id,
    syncManager,
    renderBlock
  }), [id, syncManager, renderBlock]);

  return (
    <EditorContext.Provider value={value}>
      <div className={`neo-editor ${className || ''}`} style={{ 
        backgroundColor: 'var(--neo-bg-canvas)', 
        color: 'var(--neo-text-primary)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Toolbar/Menu Area (if children provided) */}
        {children}
        
        {/* Main Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
             <NeoCanvas />
        </div>
      </div>
    </EditorContext.Provider>
  );
};
