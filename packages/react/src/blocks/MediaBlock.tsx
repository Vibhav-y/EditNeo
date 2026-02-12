import React from 'react';
import { NeoBlock } from '@editneo/core';

export const MediaBlock: React.FC<{ block: NeoBlock }> = ({ block }) => {
  const { src, caption } = block.props;

  if (block.type === 'image') {
    return (
      <div className="neo-image-block" style={{ margin: '1em 0' }}>
        <img src={src} alt={caption} style={{ maxWidth: '100%', borderRadius: '4px' }} />
        {caption && <div style={{ fontSize: '0.8em', color: '#666', textAlign: 'center' }}>{caption}</div>}
      </div>
    );
  }

  if (block.type === 'video') {
    return (
      <div className="neo-video-block" style={{ margin: '1em 0' }}>
        <iframe 
            src={src} 
            style={{ width: '100%', aspectRatio: '16/9', border: 'none' }} 
            title={caption || 'Video'} 
        />
      </div>
    );
  }

  return null;
};
