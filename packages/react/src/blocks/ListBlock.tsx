import React, { useContext } from 'react';
import { NeoBlock } from '@editneo/core';
import { useStore } from 'zustand';
import { EditableBlock } from '../EditableBlock';
import { EditorContext } from '../NeoEditor';

interface ListBlockProps {
  block: NeoBlock;
  /** Auto-computed order for ordered-list blocks. */
  order?: number;
}

export const ListBlock: React.FC<ListBlockProps> = ({ block, order }) => {
  const isOrdered = block.type === 'ordered-list';
  const isTodo = block.type === 'todo-list';
  const context = useContext(EditorContext);

  const updateBlock = context ? useStore(context.store, (s) => s.updateBlock) : null;

  // (#27) Interactive checkbox for todo-list
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (updateBlock) {
      updateBlock(block.id, { props: { ...block.props, checked: e.target.checked } });
    }
  };

  // (#27a) Use computed order from parent, fall back to props, then 1
  const displayOrder = order ?? block.props?.order ?? 1;

  return (
    <div className="neo-list-item" style={{ display: 'flex', alignItems: 'flex-start', marginLeft: '1.5em' }}>
      <span style={{ marginRight: '0.5em', userSelect: 'none', flexShrink: 0, marginTop: '4px' }}>
        {isOrdered
          ? `${displayOrder}.`
          : isTodo
          ? <input
              type="checkbox"
              checked={!!block.props?.checked}
              onChange={handleCheckboxChange}
              style={{ cursor: 'pointer' }}
            />
          : '\u2022'}
      </span>
      <div style={{ flex: 1 }}>
        <EditableBlock block={block} />
      </div>
    </div>
  );
};
