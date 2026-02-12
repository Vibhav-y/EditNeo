export type BlockType = 
  | 'paragraph' 
  | 'heading-1' | 'heading-2' | 'heading-3' 
  | 'bullet-list' | 'ordered-list' | 'todo-list' 
  | 'code-block' 
  | 'image' | 'video' | 'pdf-page' 
  | 'quote' | 'divider' | 'callout';

export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  highlight?: string;
  link?: string;
}

export interface NeoBlock {
  id: string;
  type: BlockType;
  content: Span[];
  props: Record<string, any>;
  children: string[];
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface EditorState {
  blocks: Record<string, NeoBlock>;
  rootBlocks: string[];
  selection: {
    blockId: string | null;
    startOffset: number;
    endOffset: number;
  };
}
