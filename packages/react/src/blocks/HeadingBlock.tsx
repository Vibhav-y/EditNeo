import React from 'react';
import { NeoBlock } from '@editneo/core';
import { EditableBlock } from '../EditableBlock';

export const HeadingBlock: React.FC<{ block: NeoBlock }> = ({ block }) => {
  const level = parseInt(block.type.split('-')[1]);
  const fontSize = level === 1 ? '2em' : level === 2 ? '1.5em' : '1.25em';

  return (
    <div className={`neo-heading-${level}`} style={{ fontSize, fontWeight: 'bold', margin: '0.5em 0' }}>
      <EditableBlock block={block} />
    </div>
  );
};
