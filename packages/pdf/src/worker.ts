import * as pdfjs from 'pdfjs-dist';
import { NeoBlock, BlockType } from '@editneo/core';
import { v4 as uuid } from 'uuid';

/**
 * Configure the pdf.js worker automatically.
 * Uses the CDN-hosted worker matching the installed pdfjs-dist version.
 * Falls back to disabling the worker if configuration fails.
 */
function ensureWorkerConfigured() {
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      const version = pdfjs.version;
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
    } catch {
      // Fallback: disable worker (runs on main thread, slower but works)
      (pdfjs as any).disableWorker = true;
    }
  }
}

// ── Heading heuristics (#39) ──────────────────────────────────────────

interface TextItem {
  str: string;
  height: number;
  transform: number[];
  fontName?: string;
}

/**
 * (#39) Improved heading detection using multiple heuristics:
 * - Font size relative to the page mode
 * - Short line length (headings are usually < 100 chars)
 * - Bold font name patterns
 * - All-caps detection
 */
function classifyBlockType(
  item: TextItem,
  text: string,
  modeFontSize: number,
  fontStyles: Map<string, { bold: boolean }>
): BlockType {
  const ratio = item.height / modeFontSize;
  const trimmed = text.trim();
  const isShortLine = trimmed.length < 120;
  const fontInfo = item.fontName ? fontStyles.get(item.fontName) : undefined;
  const isBoldFont = fontInfo?.bold || false;
  const isAllCaps = trimmed.length > 2 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

  // Large font → heading
  if (ratio > 1.8 && isShortLine) return 'heading-1';
  if (ratio > 1.4 && isShortLine) return 'heading-2';
  if (ratio > 1.15 && isShortLine && (isBoldFont || isAllCaps)) return 'heading-3';

  // Bold short line at normal size → heading-3
  if (isBoldFont && isShortLine && trimmed.length < 60) return 'heading-3';

  return 'paragraph';
}

/**
 * Extract font style information from the page's common objects.
 * Detects bold fonts by checking the font name for common bold patterns.
 */
function extractFontStyles(page: any): Map<string, { bold: boolean }> {
  const styles = new Map<string, { bold: boolean }>();
  try {
    const commonObjs = page.commonObjs;
    if (commonObjs && commonObjs._objs) {
      for (const [key, entry] of Object.entries(commonObjs._objs as Record<string, any>)) {
        if (entry?.data?.name) {
          const name = (entry.data.name as string).toLowerCase();
          styles.set(key, {
            bold: name.includes('bold') || name.includes('heavy') || name.includes('black'),
          });
        }
      }
    }
  } catch {
    // Font extraction is best-effort
  }
  return styles;
}

// ── Image extraction (#37) ────────────────────────────────────────────

/**
 * (#37) Extract images from a PDF page's operator list.
 * Converts image data to a data URI when possible.
 */
async function extractImages(page: any, opList: any): Promise<NeoBlock[]> {
  const blocks: NeoBlock[] = [];
  const seenImages = new Set<string>();

  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] === pdfjs.OPS.paintImageXObject) {
      const imgName = opList.argsArray[i]?.[0];
      if (!imgName || seenImages.has(imgName)) continue;
      seenImages.add(imgName);

      try {
        const imgData = await new Promise<any>((resolve, reject) => {
          page.objs.get(imgName, (data: any) => {
            if (data) resolve(data);
            else reject(new Error('No image data'));
          });
        });

        if (imgData && imgData.data && imgData.width && imgData.height) {
          // Convert raw pixel data to a data URI via canvas
          const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
          if (canvas) {
            canvas.width = imgData.width;
            canvas.height = imgData.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const imageData = ctx.createImageData(imgData.width, imgData.height);

              // pdfjs image data can be RGB (3 bytes) or RGBA (4 bytes) per pixel
              const src = imgData.data;
              const dst = imageData.data;
              const bytesPerPixel = src.length / (imgData.width * imgData.height);

              if (bytesPerPixel === 4) {
                dst.set(src);
              } else if (bytesPerPixel === 3) {
                for (let j = 0, k = 0; j < dst.length; j += 4, k += 3) {
                  dst[j] = src[k];
                  dst[j + 1] = src[k + 1];
                  dst[j + 2] = src[k + 2];
                  dst[j + 3] = 255;
                }
              } else {
                // Grayscale or unsupported — skip
                continue;
              }

              ctx.putImageData(imageData, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              
              // Only include images of meaningful size (skip tiny decorative images)
              if (imgData.width > 50 && imgData.height > 50) {
                blocks.push(createBlock('image', '', { 
                  src: dataUrl,
                  width: imgData.width,
                  height: imgData.height,
                }));
              }
            }
          } else {
            // No DOM (SSR) — insert placeholder
            blocks.push(createBlock('image', '', { 
              src: 'placeholder-image-url',
              width: imgData.width,
              height: imgData.height,
            }));
          }
        }
      } catch {
        // Image extraction failed for this image — skip
      }
    }
  }

  return blocks;
}

// ── Main extraction ───────────────────────────────────────────────────

/**
 * Extract structured NeoBlocks from a PDF file.
 * 
 * @param data - An ArrayBuffer of the PDF file
 * @returns An array of NeoBlock objects
 * @throws Error with descriptive message on failure
 */
export async function extractBlocksFromPdf(data: ArrayBuffer): Promise<NeoBlock[]> {
  if (!data || data.byteLength === 0) {
    throw new Error('[EditNeo PDF] Cannot extract blocks: empty or missing PDF data');
  }

  ensureWorkerConfigured();

  let pdf;
  try {
    const loadingTask = pdfjs.getDocument(data);
    pdf = await loadingTask.promise;
  } catch (err: any) {
    if (err?.message?.includes('password')) {
      throw new Error('[EditNeo PDF] This PDF is password-protected. Please provide an unlocked file.');
    }
    throw new Error(`[EditNeo PDF] Failed to load PDF: ${err?.message || 'Unknown error'}`);
  }

  const blocks: NeoBlock[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const opList = await page.getOperatorList();
      
      // (#39) Extract font style info for heading heuristics
      const fontStyles = extractFontStyles(page);
      
      // Mode font-size calculation
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

      // Text extraction with improved line grouping
      let currentBlockText = '';
      let currentBlockType: BlockType = 'paragraph';
      let currentItem: any = null;
      let lastY = -1;

      for (const item of textContent.items) {
        if (!('str' in item)) continue;
        
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
          if (currentBlockText.trim()) {
            blocks.push(createBlock(currentBlockType, currentBlockText));
          }
          currentBlockText = '';
          // (#39) Use improved heading heuristics
          currentBlockType = classifyBlockType(
            item as TextItem, 
            item.str, 
            modeFontSize, 
            fontStyles
          );
          currentItem = item;
        }

        currentBlockText += item.str + ' ';
        lastY = item.transform[5];
        if (!currentItem) currentItem = item;
      }
      
      if (currentBlockText.trim()) {
        blocks.push(createBlock(currentBlockType, currentBlockText));
      }
      
      // (#37) Extract actual images
      const imageBlocks = await extractImages(page, opList);
      blocks.push(...imageBlocks);

    } catch (pageErr: any) {
      console.warn(`[EditNeo PDF] Failed to extract page ${i}: ${pageErr?.message}`);
    }
  }

  if (blocks.length === 0) {
    console.warn('[EditNeo PDF] No content extracted from PDF');
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
