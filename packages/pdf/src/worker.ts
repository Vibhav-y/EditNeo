import * as pdfjs from 'pdfjs-dist';
import { NeoBlock, BlockType } from '@editneo/core';
import { v4 as uuid } from 'uuid';

// Configure worker - in a real app, this needs careful path handling or a bundler plugin
// For now, we assume the worker is loaded by the main thread or handled by the build system
// pdfjs.GlobalWorkerOptions.workerSrc = ...; 

export async function extractBlocksFromPdf(data: ArrayBuffer): Promise<NeoBlock[]> {
  const loadingTask = pdfjs.getDocument(data);
  const pdf = await loadingTask.promise;
  const blocks: NeoBlock[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const opList = await page.getOperatorList();
    
    // Simplistic mode font size calculation for the page
    const fontSizes: Record<number, number> = {};
    for (const item of textContent.items) {
      if ('height' in item) {
        const height = Math.floor(item.height);
        fontSizes[height] = (fontSizes[height] || 0) + 1;
      }
    }
    
    let modeFontSize = 12;
    let maxCount = 0;
    for (const size in fontSizes) {
      if (fontSizes[size] > maxCount) {
        maxCount = fontSizes[size];
        modeFontSize = Number(size);
      }
    }

    // Heuristic 1: Text extraction
    // This is a simplified extraction that doesn't handle layout perfectly but follows the plan
    let currentBlockText = '';
    let currentBlockType: BlockType = 'paragraph';
    let lastY = -1;

    for (const item of textContent.items) {
        if (!('str' in item)) continue;
        
        // Simple line grouping test
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
             if (currentBlockText.trim()) {
                 blocks.push(createBlock(currentBlockType, currentBlockText));
             }
             currentBlockText = '';
             // Reset type based on new line height
             if (item.height > modeFontSize * 2) currentBlockType = 'heading-1';
             else if (item.height > modeFontSize * 1.5) currentBlockType = 'heading-2';
             else currentBlockType = 'paragraph';
        }

        currentBlockText += item.str + ' ';
        lastY = item.transform[5];
    }
    
    if (currentBlockText.trim()) {
        blocks.push(createBlock(currentBlockType, currentBlockText));
    }
    
    // Heuristic 2: Images (Simplistic mock logic as real extraction form opList is complex)
    // Real implementation requires processing opList.fnArray and argsArray for PaintImageXObject
    // For this task, we will just add a placeholder if we detect image ops
    if (opList.fnArray.includes(pdfjs.OPS.paintImageXObject)) {
         blocks.push(createBlock('image', '', { src: 'placeholder-image-url' }));
    }
  }

  return blocks;
}

function createBlock(type: BlockType, text: string, props: Record<string, any> = {}): NeoBlock {
    return {
        id: uuid(),
        type,
        content: [{ text: text.trim() }],
        props,
        children: [],
        parentId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}
