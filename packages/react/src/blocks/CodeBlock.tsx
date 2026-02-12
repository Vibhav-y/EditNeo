import React from 'react';
import { NeoBlock } from '@editneo/core';
import { EditableBlock } from '../EditableBlock';

export const CodeBlock: React.FC<{ block: NeoBlock }> = ({ block }) => {
  return (
    <pre className="neo-code-block" style={{ 
      backgroundColor: '#f5f5f5', 
      padding: '1em', 
      borderRadius: '4px',
      fontFamily: 'var(--neo-code-font)',
      overflowX: 'auto'
    }}>
      <code>
        <EditableBlock block={block} />
      </code>
    </pre>
  );
};
