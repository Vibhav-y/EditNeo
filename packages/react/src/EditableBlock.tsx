import React, { useRef, useContext, useEffect, useCallback } from 'react';
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

/** Render Span[] to HTML string for innerHTML injection. */
function spansToHtml(spans: Span[]): string {
  return spans.map((span) => {
    let html = escapeHtml(span.text);

    // Wrap in formatting tags (innermost first)
    if (span.bold) html = `<strong>${html}</strong>`;
    if (span.italic) html = `<em>${html}</em>`;
    if (span.underline) html = `<u>${html}</u>`;
    if (span.strike) html = `<s>${html}</s>`;
    if (span.code) {
      html = `<code style="font-family:var(--neo-code-font,monospace);background:#eee;padding:2px 4px;border-radius:3px">${html}</code>`;
    }

    // Apply inline styles for color/highlight
    const styles: string[] = [];
    if (span.color) styles.push(`color:${span.color}`);
    if (span.highlight) styles.push(`background-color:${span.highlight}`);
    if (styles.length > 0) {
      html = `<span style="${styles.join(';')}">${html}</span>`;
    }

    if (span.link) {
      html = `<a href="${escapeHtml(span.link)}" style="color:var(--neo-accent-color,#3b82f6);text-decoration:underline">${html}</a>`;
    }

    return html;
  }).join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Calculate the character offset of the current selection within a contentEditable element.
 * Walks all text nodes in document order and sums lengths until we reach the selection anchor/focus.
 */
function getCharOffset(containerEl: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT);
  let charCount = 0;

  while (walker.nextNode()) {
    const textNode = walker.currentNode;
    if (textNode === node) {
      return charCount + offset;
    }
    charCount += (textNode.textContent || '').length;
  }

  // If the node itself is the container or an element node, offset refers to child index
  // Walk text nodes up to that child
  if (node === containerEl || node.nodeType === Node.ELEMENT_NODE) {
    const children = Array.from(node.childNodes);
    const targetChild = children[Math.min(offset, children.length)];
    const allWalker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT);
    let count = 0;
    while (allWalker.nextNode()) {
      if (targetChild && allWalker.currentNode === targetChild) break;
      // Check if this text node is before the target
      if (targetChild && node.compareDocumentPosition(allWalker.currentNode) & Node.DOCUMENT_POSITION_FOLLOWING) break;
      count += (allWalker.currentNode.textContent || '').length;
    }
    return count;
  }

  return charCount;
}

/**
 * Set the cursor position in a contentEditable element to a specific character offset.
 */
function setCursorToOffset(containerEl: HTMLElement, targetOffset: number) {
  const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT);
  let offset = 0;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const len = textNode.length;

    if (offset + len >= targetOffset) {
      const range = document.createRange();
      range.setStart(textNode, targetOffset - offset);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    offset += len;
  }

  // If offset exceeds total text, place at end
  const range = document.createRange();
  range.selectNodeContents(containerEl);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export const EditableBlock: React.FC<EditableBlockProps> = ({ block, autoFocus }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const context = useContext(EditorContext);
  // Track the content we last wrote to the DOM to detect external changes
  const lastRenderedContentRef = useRef<string>('');
  // Flag to suppress store updates when we're syncing from store → DOM
  const isSyncingFromStoreRef = useRef(false);

  if (!context) {
    throw new Error('EditableBlock must be used within a NeoEditor');
  }

  const updateBlock = useStore(context.store, (state) => state.updateBlock);
  const addBlock = useStore(context.store, (state) => state.addBlock);
  const deleteBlock = useStore(context.store, (state) => state.deleteBlock);
  const undo = useStore(context.store, (state) => state.undo);
  const redo = useStore(context.store, (state) => state.redo);
  const setSelection = useStore(context.store, (state) => state.setSelection);
  const rootBlocks = useStore(context.store, (state) => state.rootBlocks);

  // --- Uncontrolled DOM: render spans as innerHTML, not React children ---

  // Initial mount: set innerHTML from block content
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const html = spansToHtml(block.content);
    el.innerHTML = html;
    lastRenderedContentRef.current = html;

    if (autoFocus) {
      el.focus();
    }
    // Only run on mount (block.id change means a new block)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id]);

  // External content changes (undo, redo, remote sync): resync innerHTML
  // We compare the new content's HTML to what we last rendered.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // Don't resync if we're the ones who just updated the store
    if (isSyncingFromStoreRef.current) {
      isSyncingFromStoreRef.current = false;
      return;
    }

    const html = spansToHtml(block.content);
    if (html !== lastRenderedContentRef.current) {
      // Save cursor position
      const sel = window.getSelection();
      let savedOffset = 0;
      if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        savedOffset = getCharOffset(el, sel.anchorNode!, sel.anchorOffset);
      }

      el.innerHTML = html;
      lastRenderedContentRef.current = html;

      // Restore cursor if this element was focused
      if (document.activeElement === el || el.contains(document.activeElement)) {
        setCursorToOffset(el, savedOffset);
      }
    }
  }, [block.content]);

  /** Parse DOM back into spans on input */
  const handleInput = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const newSpans = parseContentEditableToSpans(el);
    lastRenderedContentRef.current = el.innerHTML;
    isSyncingFromStoreRef.current = true;
    updateBlock(block.id, { content: newSpans });
  }, [block.id, updateBlock]);

  /** Sync DOM selection → store selection */
  const handleSelect = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (!el.contains(sel.anchorNode)) return;

    const startOffset = getCharOffset(el, sel.anchorNode!, sel.anchorOffset);
    const endOffset = sel.isCollapsed
      ? startOffset
      : getCharOffset(el, sel.focusNode!, sel.focusOffset);

    const lo = Math.min(startOffset, endOffset);
    const hi = Math.max(startOffset, endOffset);
    setSelection(block.id, lo, hi);
  }, [block.id, setSelection]);

  /** Register document selectionchange listener */
  useEffect(() => {
    const onSelectionChange = () => {
      const el = contentRef.current;
      if (!el) return;
      // Only handle if this element is focused
      if (document.activeElement === el || el.contains(document.activeElement)) {
        handleSelect();
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [handleSelect]);

  /** Keyboard shortcuts */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
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

    const el = contentRef.current;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBlock('paragraph', block.id);
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter: let browser insert <br> (soft break)
    } else if (e.key === 'Backspace' && el?.innerText.trim() === '') {
      e.preventDefault();
      deleteBlock(block.id);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      // Navigate to previous block if at the start
      if (el) {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed) {
          const offset = getCharOffset(el, sel.anchorNode!, sel.anchorOffset);
          if (offset === 0) {
            e.preventDefault();
            const idx = rootBlocks.indexOf(block.id);
            if (idx > 0) {
              const prevBlockId = rootBlocks[idx - 1];
              setSelection(prevBlockId, Infinity, Infinity);
              // Focus the previous block's contentEditable
              const prevEl = el.closest('.neo-editor')?.querySelector(
                `[data-block-id="${prevBlockId}"] [contenteditable]`
              ) as HTMLElement;
              if (prevEl) {
                prevEl.focus();
                // Place cursor at end
                const range = document.createRange();
                range.selectNodeContents(prevEl);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }
          }
        }
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      // Navigate to next block if at the end
      if (el) {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed) {
          const offset = getCharOffset(el, sel.anchorNode!, sel.anchorOffset);
          const totalLen = (el.textContent || '').length;
          if (offset >= totalLen) {
            e.preventDefault();
            const idx = rootBlocks.indexOf(block.id);
            if (idx < rootBlocks.length - 1) {
              const nextBlockId = rootBlocks[idx + 1];
              setSelection(nextBlockId, 0, 0);
              const nextEl = el.closest('.neo-editor')?.querySelector(
                `[data-block-id="${nextBlockId}"] [contenteditable]`
              ) as HTMLElement;
              if (nextEl) {
                nextEl.focus();
                setCursorToOffset(nextEl, 0);
              }
            }
          }
        }
      }
    }
  }, [undo, redo, addBlock, deleteBlock, block.id, rootBlocks, setSelection]);

  return (
    <div
      data-block-id={block.id}
      style={{ position: 'relative' }}
    >
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="neo-editable-block"
        style={{
          minHeight: '24px',
          outline: 'none',
          padding: '4px 0',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: block.type === 'heading-1' ? '2em'
                 : block.type === 'heading-2' ? '1.5em'
                 : block.type === 'heading-3' ? '1.25em'
                 : '1em',
          fontWeight: block.type.startsWith('heading') ? 'bold' : 'normal',
        }}
      />
    </div>
  );
};
