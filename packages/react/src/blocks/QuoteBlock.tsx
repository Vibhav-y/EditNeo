import React from 'react';
import { NeoBlock } from '@editneo/core';
import { EditableBlock } from '../EditableBlock';

export const QuoteBlock: React.FC<{ block: NeoBlock }> = ({ block }) => {
  return (
    <blockquote className="neo-quote-block" style={{ 
      borderLeft: '4px solid var(--neo-accent-color)', 
      paddingLeft: '1em', 
      margin: '1em 0',
      color: '#555',
      fontStyle: 'italic'
    }}>
      <EditableBlock block={block} />
    </blockquote>
  );
};
