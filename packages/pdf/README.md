# @editneo/pdf

Client-side PDF-to-blocks extraction for EditNeo. This package reads a PDF file in the browser, analyzes its text content and layout, and converts it into an array of `NeoBlock` objects that the editor can render and edit.

All processing happens locally — no files are uploaded to any server.

## Installation

```bash
npm install @editneo/pdf @editneo/core
```

This package depends on [pdfjs-dist](https://github.com/nicolo-ribaudo/pdfjs-dist) for PDF parsing. The pdf.js worker is auto-configured from CDN.

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

The `PDFDropZone` component from `@editneo/react` calls this function automatically when a user drops a PDF onto the editor:

```tsx
import { PDFDropZone } from "@editneo/react";

<PDFDropZone>{/* editor content */}</PDFDropZone>;
```

### Error handling

The function provides clear error messages for common failures:

```typescript
try {
  const blocks = await extractBlocksFromPdf(buffer);
} catch (err) {
  // Possible errors:
  // "[EditNeo PDF] Cannot extract blocks: empty or missing PDF data"
  // "[EditNeo PDF] This PDF is password-protected. Please provide an unlocked file."
  // "[EditNeo PDF] Failed to load PDF: <reason>"
  console.error(err.message);
}
```

Per-page errors are caught individually — one corrupted page won't prevent the rest from extracting.

## How Extraction Works

The extraction processes each page of the PDF in order and applies heuristics to convert raw PDF content into structured blocks.

### Text extraction

PDF files don't have a concept of "paragraphs" or "headings" — they store positioned text fragments with font metadata. The extractor groups these fragments into blocks using vertical position gaps (>5 PDF units between lines starts a new block).

### Heading detection

Headings are classified using multiple signals:

- **Font size ratio** — text significantly larger than the page's most common font size
  - \>1.8× → `heading-1`
  - \>1.4× → `heading-2`
  - \>1.15× (if bold or all-caps) → `heading-3`
- **Bold font name** — fonts with "Bold", "Heavy", or "Black" in the name
- **Line length** — headings are typically shorter than 120 characters
- **All-caps** — uppercase text at normal size with a bold font → `heading-3`

### Image extraction

The extractor scans each page's operator list for `PaintImageXObject` operations. When found, the raw pixel data is read and converted to a PNG data URI via canvas. Small decorative images (<50×50px) are filtered out. In SSR environments where `document.createElement` isn't available, a placeholder is used instead.

### Limitations

- **Multi-column layouts** — text from different columns may be merged or ordered incorrectly
- **Tables** — table content is extracted as plain text, not as a structured table block
- **Footnotes and headers/footers** — these are extracted as regular text blocks
- **Scanned PDFs** — if the PDF contains only images (no text layer), the extractor produces only image blocks. OCR is not performed.

## API Reference

### `extractBlocksFromPdf(data)`

| Parameter | Type          | Description           |
| --------- | ------------- | --------------------- |
| `data`    | `ArrayBuffer` | The raw PDF file data |

**Returns:** `Promise<NeoBlock[]>`

**Throws:** `Error` with descriptive message on failure (empty data, password-protected, corrupt file).

An array of `NeoBlock` objects in reading order. Each block has:

- A generated UUID as its `id`
- A `type` inferred from the content (`paragraph`, `heading-1`, `heading-2`, `heading-3`, or `image`)
- A `content` array with a single `Span` containing the extracted text
- Image blocks include `props.src` (data URI), `props.width`, and `props.height`
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
    props: { src: "data:image/png;base64,...", width: 640, height: 480 },
    children: [],
    parentId: null,
    createdAt: 1707840000000,
    updatedAt: 1707840000000,
  },
];
```

## License

MIT
