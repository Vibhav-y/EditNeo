import React, { useContext } from 'react';
import { NeoBlock } from '@editneo/core';
import { EditableBlock } from './EditableBlock';
import { EditorContext } from './NeoEditor';

// Placeholder components for rich blocks (will be implemented in separate files later or inline if simple)
// For now, consistent with the plan, we'll create basic versions or use EditableBlock with specific styles
import { HeadingBlock } from './blocks/HeadingBlock';
import { ListBlock } from './blocks/ListBlock';
import { MediaBlock } from './blocks/MediaBlock';
import { CodeBlock } from './blocks/CodeBlock';
import { QuoteBlock } from './blocks/QuoteBlock';
import { CalloutBlock } from './blocks/CalloutBlock';
import { DividerBlock } from './blocks/DividerBlock';

interface BlockRendererProps {
  block: NeoBlock;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({ block }) => {
  const context = useContext(EditorContext);

  // Allow user override
  if (context?.renderBlock) {
    const customRender = context.renderBlock(block, (b: NeoBlock) => <DefaultRender block={b} />);
    if (customRender) return <>{customRender}</>;
  }

  return <DefaultRender block={block} />;
};

const DefaultRender: React.FC<BlockRendererProps> = ({ block }) => {
  switch (block.type) {
    case 'heading-1':
    case 'heading-2':
    case 'heading-3':
      return <HeadingBlock block={block} />;
    case 'bullet-list':
    case 'ordered-list':
    case 'todo-list':
      return <ListBlock block={block} />;
    case 'image':
    case 'video':
      return <MediaBlock block={block} />;
    case 'code-block':
        return <CodeBlock block={block} />;
    case 'quote':
        return <QuoteBlock block={block} />;
    case 'callout':
        return <CalloutBlock block={block} />;
    case 'divider':
        return <DividerBlock block={block} />;
    case 'paragraph':
    default:
      return <EditableBlock block={block} />;
  }
};
