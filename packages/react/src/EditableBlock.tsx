import React, { useRef, useContext, useEffect } from 'react';
import { NeoBlock, Span } from '@editneo/core';
import { useStore } from 'zustand';
import { EditorContext } from './NeoEditor';

interface EditableBlockProps {
  block: NeoBlock;
  autoFocus?: boolean;
}

/**
 * Parse the contentEditable DOM back into Span[] preserving inline formatting.
 * Walks the child nodes and reads computed/element styles to reconstruct
 * bold, italic, underline, strikethrough, code, link, color, and highlight.
 */
function parseContentEditableToSpans(el: HTMLElement): Span[] {
  const spans: Span[] = [];

  function walk(node: Node, inherited: Partial<Span>) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.length > 0) {
        spans.push({ text, ...inherited });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const elem = node as HTMLElement;
    const tag = elem.tagName.toLowerCase();

    // Build formatting from the element
    const fmt: Partial<Span> = { ...inherited };

    if (tag === 'b' || tag === 'strong') fmt.bold = true;
    if (tag === 'i' || tag === 'em') fmt.italic = true;
    if (tag === 'u') fmt.underline = true;
    if (tag === 's' || tag === 'del' || tag === 'strike') fmt.strike = true;
    if (tag === 'code') fmt.code = true;
    if (tag === 'a') fmt.link = elem.getAttribute('href') || undefined;

    // Check inline styles
    const style = elem.style;
    if (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700) fmt.bold = true;
    if (style.fontStyle === 'italic') fmt.italic = true;
    if (style.textDecoration?.includes('underline')) fmt.underline = true;
    if (style.textDecoration?.includes('line-through')) fmt.strike = true;
    if (style.color) fmt.color = style.color;
    if (style.backgroundColor && style.backgroundColor !== 'transparent') fmt.highlight = style.backgroundColor;

    for (const child of Array.from(elem.childNodes)) {
      walk(child, fmt);
    }
  }

  for (const child of Array.from(el.childNodes)) {
    walk(child, {});
  }

  // Merge adjacent spans with identical formatting
  const merged: Span[] = [];
  for (const span of spans) {
    const prev = merged[merged.length - 1];
    if (prev && spansHaveSameFormat(prev, span)) {
      prev.text += span.text;
    } else {
      merged.push({ ...span });
    }
  }

  return merged;
}

function spansHaveSameFormat(a: Span, b: Span): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.strike === !!b.strike &&
    !!a.code === !!b.code &&
    (a.color || '') === (b.color || '') &&
    (a.highlight || '') === (b.highlight || '') &&
    (a.link || '') === (b.link || '')
  );
}

export const EditableBlock: React.FC<EditableBlockProps> = ({ block, autoFocus }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const context = useContext(EditorContext);

  if (!context) {
    throw new Error('EditableBlock must be used within a NeoEditor');
  }

  const updateBlock = useStore(context.store, (state) => state.updateBlock);
  const addBlock = useStore(context.store, (state) => state.addBlock);
  const deleteBlock = useStore(context.store, (state) => state.deleteBlock);
  const undo = useStore(context.store, (state) => state.undo);
  const redo = useStore(context.store, (state) => state.redo);

  useEffect(() => {
    if (autoFocus && contentRef.current) {
      contentRef.current.focus();
    }
  }, [autoFocus]);

  /** (#9) Parse DOM back into spans preserving formatting */
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const el = contentRef.current;
    if (!el) return;
    const newSpans = parseContentEditableToSpans(el);
    updateBlock(block.id, { content: newSpans });
  };

  /** (#23) Additional keyboard shortcuts */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ctrl+Z / Cmd+Z = undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    // Ctrl+Shift+Z / Ctrl+Y = redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBlock('paragraph', block.id);
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter: let browser insert <br> (soft break) — don't prevent default
    } else if (e.key === 'Backspace' && contentRef.current?.innerText === '') {
      e.preventDefault();
      deleteBlock(block.id);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Insert 2 spaces for now — real indent to be added
      document.execCommand('insertText', false, '  ');
    }
  };

  return (
    <div
      ref={contentRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      style={{
        minHeight: '24px',
        outline: 'none',
        padding: '4px 0',
        fontSize: block.type === 'heading-1' ? '2em' 
               : block.type === 'heading-2' ? '1.5em'
               : block.type === 'heading-3' ? '1.25em'
               : '1em',
        fontWeight: block.type.startsWith('heading') ? 'bold' : 'normal',
      }}
    >
      {block.content.map((span, i) => {
        let style: React.CSSProperties = {};
        if (span.bold) style.fontWeight = 'bold';
        if (span.italic) style.fontStyle = 'italic';
        if (span.underline) style.textDecoration = 'underline';
        if (span.strike) style.textDecoration = (style.textDecoration ? style.textDecoration + ' ' : '') + 'line-through';
        if (span.color) style.color = span.color;
        if (span.highlight) style.backgroundColor = span.highlight;

        const content = <span key={i} style={style}>{span.text}</span>;

        if (span.code) {
          return <code key={i} style={{ fontFamily: 'var(--neo-code-font, monospace)', backgroundColor: '#eee', padding: '2px 4px', borderRadius: '3px' }}>{content}</code>;
        }

        if (span.link) {
          return <a key={i} href={span.link} style={{ color: 'var(--neo-accent-color, #3b82f6)', textDecoration: 'underline' }}>{content}</a>;
        }
        
        return content;
      })}
    </div>
  );
};
