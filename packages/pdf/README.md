# @editneo/pdf

Client-side PDF-to-blocks extraction for EditNeo. This package reads a PDF file in the browser, analyzes its text content and layout, and converts it into an array of `NeoBlock` objects that the editor can render and edit.

All processing happens locally — no files are uploaded to any server.

## Installation

```bash
npm install @editneo/pdf @editneo/core
```

This package depends on [pdfjs-dist](https://github.com/nicolo-ribaudo/pdfjs-dist) for PDF parsing.

## Usage

```typescript
import { extractBlocksFromPdf } from "@editneo/pdf";

// Get the PDF as an ArrayBuffer (from a file input, drag-and-drop, fetch, etc.)
const file = event.dataTransfer.files[0];
const buffer = await file.arrayBuffer();

const blocks = await extractBlocksFromPdf(buffer);
// blocks: NeoBlock[]
```

Each returned block has a type inferred from the PDF content (paragraphs, headings, images) and contains the extracted text as spans.

### With the React drop zone

The `PDFDropZone` component from `@editneo/react` calls this function automatically when a user drops a PDF onto the editor. You only need this package directly if you want to handle PDF extraction yourself.

```tsx
import { PDFDropZone } from "@editneo/react";

<PDFDropZone>{/* editor content */}</PDFDropZone>;
```

## How Extraction Works

The extraction processes each page of the PDF in order and applies heuristics to convert raw PDF content into structured blocks.

### Text extraction

PDF files don't have a concept of "paragraphs" or "headings" — they store positioned text fragments with font metadata. The extractor groups these fragments into blocks using two signals:

1. **Vertical position:** When there's a significant vertical gap between consecutive text items (more than 5 PDF units), the extractor treats them as separate blocks.

2. **Font size:** The extractor calculates the most common font size on each page (the "mode"). Text items significantly larger than the mode are classified as headings:
   - Greater than 2x the mode font size: `heading-1`
   - Greater than 1.5x the mode font size: `heading-2`
   - Everything else: `paragraph`

### Image detection

The extractor scans each page's operator list for `PaintImageXObject` operations, which indicate rendered images. When found, an `image` block is added to the output.

Note: Full image data extraction (decoding the pixel data from the PDF) requires additional processing of the operator list's argument arrays. The current implementation adds placeholder image blocks — proper image extraction can be implemented by processing `page.getOperatorList()` results in more detail.

### Limitations

This is a heuristic-based extractor designed for common document layouts. Some things it does not handle perfectly:

- **Multi-column layouts** — text from different columns may be merged or ordered incorrectly
- **Tables** — table content is extracted as plain text, not as a structured table block
- **Footnotes and headers/footers** — these are extracted as regular text blocks
- **Scanned PDFs** — if the PDF contains only images (no text layer), the extractor produces only image blocks. OCR is not performed.
- **Complex font detection** — bold and italic detection based on font name analysis is not yet implemented; all text is returned as plain spans

## API Reference

### `extractBlocksFromPdf(data)`

| Parameter | Type          | Description           |
| --------- | ------------- | --------------------- |
| `data`    | `ArrayBuffer` | The raw PDF file data |

**Returns:** `Promise<NeoBlock[]>`

An array of `NeoBlock` objects in reading order. Each block has:

- A generated UUID as its `id`
- A `type` inferred from the content (`paragraph`, `heading-1`, `heading-2`, or `image`)
- A `content` array with a single `Span` containing the extracted text
- `createdAt` and `updatedAt` timestamps set to the extraction time

### Example output

Given a PDF with a title, some body text, and an image, the function might return:

```typescript
[
  {
    id: "a1b2c3...",
    type: "heading-1",
    content: [{ text: "Introduction to EditNeo" }],
    props: {},
    children: [],
    parentId: null,
    createdAt: 1707840000000,
    updatedAt: 1707840000000,
  },
  {
    id: "d4e5f6...",
    type: "paragraph",
    content: [{ text: "EditNeo is a modular block-based editor..." }],
    props: {},
    children: [],
    parentId: null,
    createdAt: 1707840000000,
    updatedAt: 1707840000000,
  },
  {
    id: "g7h8i9...",
    type: "image",
    content: [{ text: "" }],
    props: { src: "placeholder-image-url" },
    children: [],
    parentId: null,
    createdAt: 1707840000000,
    updatedAt: 1707840000000,
  },
];
```

## License

MIT
