import React from 'react';
import { NeoBlock } from '@editneo/core';

export const DividerBlock: React.FC<{ block: NeoBlock }> = () => {
  return <hr className="neo-divider-block" style={{ border: 'none', borderTop: '1px solid #ccc', margin: '2em 0' }} />;
};
