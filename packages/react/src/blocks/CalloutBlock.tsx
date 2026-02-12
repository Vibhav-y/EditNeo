import React from 'react';
import { NeoBlock } from '@editneo/core';
import { EditableBlock } from '../EditableBlock';

export const CalloutBlock: React.FC<{ block: NeoBlock }> = ({ block }) => {
  const { type = 'info', icon = '💡' } = block.props; // info, warning, error
  
  let bg = '#e0f2fe';
  let color = '#0369a1';
  
  if (type === 'warning') {
    bg = '#fef9c3';
    color = '#854d0e';
  } else if (type === 'error') {
    bg = '#fee2e2';
    color = '#991b1b';
  }

  return (
    <div className="neo-callout-block" style={{ 
      backgroundColor: bg, 
      color: color, 
      padding: '1em', 
      borderRadius: '4px',
      display: 'flex',
      gap: '0.5em',
      alignItems: 'flex-start',
      margin: '1em 0'
    }}>
      <span style={{ fontSize: '1.2em' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <EditableBlock block={block} />
      </div>
    </div>
  );
};
