import React from 'react';
import { NeoBlock } from '@editneo/core';
import { EditableBlock } from '../EditableBlock';

export const ListBlock: React.FC<{ block: NeoBlock }> = ({ block }) => {
  const isOrdered = block.type === 'ordered-list';
  const isTodo = block.type === 'todo-list';

  return (
    <div className="neo-list-item" style={{ display: 'flex', alignItems: 'flex-start', marginLeft: '1.5em' }}>
      <span style={{ marginRight: '0.5em', userSelect: 'none' }}>
        {isOrdered ? '1.' : isTodo ? <input type="checkbox" disabled /> : '•'}
      </span>
      <div style={{ flex: 1 }}>
        <EditableBlock block={block} />
      </div>
    </div>
  );
};
