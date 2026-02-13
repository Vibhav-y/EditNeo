import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createEditorStore, EditorStoreInstance, EditorStore } from '@editneo/core';
import { useStore } from 'zustand';
import { NeoCanvas } from './NeoCanvas';
import './styles.css';

export interface NeoEditorProps {
  id: string;
  offline?: boolean;
  syncConfig?: {
    url: string;
    room: string;
  };
  renderBlock?: (block: any, defaultRender: any) => React.ReactNode;
  className?: string;
  theme?: {
    mode: 'light' | 'dark';
    [key: string]: any;
  };
  children?: React.ReactNode;
}

interface EditorContextValue {
  editorId: string;
  store: EditorStoreInstance;
  syncManager: any | null;
  renderBlock?: (block: any, defaultRender: any) => React.ReactNode;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

/**
 * Hook to access the current editor's Zustand store via context.
 * Supports selectors for fine-grained re-render control.
 */
export function useEditorStoreContext<T>(selector: (state: EditorStore) => T): T {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error('useEditorStoreContext must be used within a <NeoEditor />');
  }
  return useStore(ctx.store, selector);
}

export const NeoEditor: React.FC<NeoEditorProps> = ({
  id,
  offline = true,
  syncConfig,
  renderBlock,
  className,
  theme,
  children
}) => {
  // Create a store instance that lives for the lifetime of this editor.
  const storeRef = useRef<EditorStoreInstance>();
  if (!storeRef.current) {
    storeRef.current = createEditorStore();
  }

  const editorRootRef = useRef<HTMLDivElement>(null);
  const [syncManager, setSyncManager] = useState<any | null>(null);

  // (#13) Only create SyncManager when sync or offline persistence is needed
  useEffect(() => {
    // Lazy-import sync to avoid forcing all consumers to install @editneo/sync
    const needsSync = syncConfig || offline;
    if (!needsSync) return;

    let manager: any = null;

    import('@editneo/sync').then(({ SyncManager }) => {
      manager = new SyncManager(id, syncConfig);
      manager.bindStore(storeRef.current!);
      setSyncManager(manager);
    }).catch(() => {
      // @editneo/sync not installed — silently skip
      console.warn('@editneo/sync is not installed. Sync and offline persistence are disabled.');
    });

    return () => {
      if (manager) manager.destroy();
    };
  }, [id, syncConfig, offline]);

  // (#22) Scope theme to this editor's root element, not document.documentElement
  useEffect(() => {
    const el = editorRootRef.current;
    if (!el) return;

    if (theme?.mode === 'dark') {
      el.style.setProperty('--neo-bg-canvas', '#0f172a');
      el.style.setProperty('--neo-text-primary', '#f3f4f6');
      el.style.setProperty('--neo-selection-color', '#334155');
    } else {
      el.style.setProperty('--neo-bg-canvas', '#ffffff');
      el.style.setProperty('--neo-text-primary', '#111827');
      el.style.setProperty('--neo-selection-color', '#b4d5fe');
    }
  }, [theme]);

  const value = useMemo((): EditorContextValue => ({
    editorId: id,
    store: storeRef.current!,
    syncManager,
    renderBlock
  }), [id, syncManager, renderBlock]);

  return (
    <EditorContext.Provider value={value}>
      <div
        ref={editorRootRef}
        className={`neo-editor ${className || ''}`}
        style={{ 
          backgroundColor: 'var(--neo-bg-canvas)', 
          color: 'var(--neo-text-primary)',
          fontFamily: 'var(--neo-font-family)',
          fontSize: 'var(--neo-font-size-body)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {children}
        <div style={{ flex: 1, position: 'relative' }}>
             <NeoCanvas />
        </div>
      </div>
    </EditorContext.Provider>
  );
};
