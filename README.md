# PDF Review & Versioning Tool

> A full-featured PDF review platform with version control, visual diffing, and annotated export — built as a pure frontend Next.js application with local-first architecture.

**[Architecture](./ARCHITECTURE.md)** | **[Process Log](./PROCESS.md)**

---

## Features

### Upload & Viewing
| Feature | Status | Description |
|---------|--------|-------------|
| Full-screen upload zone | Done | Drag-drop with animated visual feedback, Browse Files button |
| PDF rendering | Done | High-fidelity rendering via PSPDFKit SDK |
| Page thumbnails | Done | Visual navigation in dark-themed left sidebar |
| Zoom & pan controls | Done | PSPDFKit toolbar with zoom, pager, search |
| Annotation toolbar | Done | Ink, highlighter, text-highlighter, notes, text tools |
| Text selection | Done | Select and copy text from PDFs |
| Search | Done | PSPDFKit search with hit count and prev/next |
| Dark sidebars | Done | #1a1a2e sidebar theme with lighter main area |
| Version badge | Done | Shows current version (V1, V2, ...) in header |
| Responsive layout | Done | Collapsible sidebars, smooth transitions |
| Fade transitions | Done | Smooth animation between upload screen and viewer |
| Loading skeleton | Done | Pulse animation while PDF and pages load |
| Error boundary | Done | Friendly "Something went wrong" with retry button |
| Keyboard shortcuts | Done | Ctrl+S (commit), Ctrl+E (export) |

### Editing & Annotations
| Feature | Status | Description |
|---------|--------|-------------|
| Annotation toolbar | Done | Floating toolbar with pointer, highlight, note, text, redaction tools |
| Highlight with colors | Done | Yellow, green, blue, pink color picker dropdown |
| Sticky notes | Done | Click to place, popup for text input |
| Free text box | Done | Click and drag to create positioned text area |
| Redaction tool | Done | Rectangle redaction mask tool |
| Ink drawing | Done | PSPDFKit ink tool in toolbar |
| Annotation list | Done | Sidebar list with type icons, page numbers, preview text |
| Annotation navigation | Done | Click annotation to jump to its page |
| Annotation deletion | Done | Two-click confirmation delete |
| Change tracking | Done | Tracks create/update/delete events from PSPDFKit |
| Unsaved changes badge | Done | Header badge with count of pending changes |

### Version Control
| Feature | Status | Description |
|---------|--------|-------------|
| Create versions | Done | Commit dialog with message, exports PDF + annotations + text |
| Version history | Done | Timeline in right sidebar with relative timestamps |
| Switch versions | Done | Load any previous version with unsaved changes warning |
| Version metadata | Done | Timestamp, message, annotation count badge |
| Text extraction | Done | Per-page text extraction stored for future diffing |

### Diff & Compare
| Feature | Status | Description |
|---------|--------|-------------|
| Select versions to compare | Done | Two dropdown selectors for base and compare versions |
| Text diff | Done | Per-page text diff with green additions, red deletions |
| Annotation diff | Done | Added/removed/modified annotation detection |
| Diff summary panel | Done | Total changes, per-type breakdown, page navigation |
| Diff legend | Done | Color-coded legend with visibility toggles |
| Change navigation | Done | Next/Previous buttons to cycle through changed pages |

### Export
| Feature | Status | Description |
|---------|--------|-------------|
| Export Annotated PDF | Done | Download PDF with changelog cover page and inline callouts |
| Change log cover page | Done | Version history table with dates, messages, change counts |
| Inline callouts | Done | Light blue callout boxes on affected pages showing changes |

### Backend API (Mock)
| Feature | Status | Description |
|---------|--------|-------------|
| Document CRUD | Done | POST/GET for documents with in-memory storage |
| Version management | Done | POST/GET for versions per document |
| Diff endpoint | Done | GET with query params for text + annotation diff |
| IndexedDB persistence | Done | Offline-first local storage for the frontend |

---

## Tech Stack

| Technology | Purpose | Why This Choice |
|------------|---------|--------------------|
| [Next.js 16](https://nextjs.org/) | Framework | App Router with React Server Components support; route handlers for mock API |
| [TypeScript](https://www.typescriptlang.org/) | Type Safety | Strict mode catches bugs early; comprehensive types serve as documentation |
| [Tailwind CSS v4](https://tailwindcss.com/) | Styling | Native CSS nesting, better performance, utility-first approach |
| [shadcn/ui](https://ui.shadcn.com/) | Components | Accessible, customizable primitives that own the code; no external dependency lock-in |
| [PSPDFKit](https://pspdfkit.com/) | PDF Engine | Production-grade rendering + annotations; PDF.js lacks annotation UX out of the box |
| [Zustand](https://zustand-demo.pmnd.rs/) | State | ~1KB, zero boilerplate vs Redux; three focused stores (document, version, annotation) |
| [Dexie](https://dexie.org/) | IndexedDB | Promise-based API, handles binary blobs efficiently, schema migrations built-in |
| [pdf-lib](https://pdf-lib.js.org/) | PDF Manipulation | Pure JS for creating cover pages and drawing callout graphics without a server |
| [diff-match-patch](https://github.com/google/diff-match-patch) | Diffing | Google's battle-tested algorithm for character-level text comparison |
| [Lucide React](https://lucide.dev/) | Icons | Tree-shakeable, consistent design, lighter than FontAwesome |
| [Sonner](https://sonner.emilkowal.ski/) | Toasts | Beautiful, accessible notifications with minimal API |

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/pdf-review-tool.git
cd pdf-review-tool

# Install dependencies
npm install

# Copy PSPDFKit assets (done automatically via postinstall, but manual if needed)
mkdir -p public/pspdfkit-lib
cp -R node_modules/pspdfkit/dist/pspdfkit-lib/* public/pspdfkit-lib/

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### PSPDFKit Setup

This project uses PSPDFKit in **evaluation mode** (displays watermark). For production:

1. Get a license from [PSPDFKit](https://pspdfkit.com/try/)
2. Add to `.env.local`:
   ```env
   NEXT_PUBLIC_PSPDFKIT_LICENSE_KEY=your-license-key
   ```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_PSPDFKIT_LICENSE_KEY` | No | Removes PSPDFKit watermark |

---

## Architecture Overview

The application follows a **local-first architecture** — all data lives in IndexedDB, enabling offline functionality and instant operations. A mock backend API provides route handlers for future server integration.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser Client                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌─────────────────────────────┐  ┌────────────────┐ │
│  │  Left    │  │                             │  │     Right      │ │
│  │ Sidebar  │  │       PDF Viewer            │  │    Sidebar     │ │
│  │ (Pages)  │  │      (PSPDFKit)             │  │  (Versions +   │ │
│  │  240px   │  │                             │  │  Annotations)  │ │
│  └──────────┘  └─────────────────────────────┘  └────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                      State Layer (Zustand)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ useDocumentStore │  │ useVersionStore │  │useAnnotationStore│   │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                    Persistence Layer (Dexie)                        │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │  documents   │  │   versions   │                                │
│  └──────────────┘  └──────────────┘                                │
│                        IndexedDB                                    │
├─────────────────────────────────────────────────────────────────────┤
│                    Mock API Layer (Next.js)                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Route Handlers: /api/documents, /versions, /diff            │  │
│  │  In-Memory Map Storage (server-side)                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for detailed Mermaid diagrams including data flow, component hierarchy, and production scaling.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with Toaster, metadata
│   ├── page.tsx                # Main 3-column layout with keyboard shortcuts
│   ├── globals.css             # Tailwind + shadcn styles + dark sidebar theme
│   ├── favicon.svg             # PDF document icon
│   └── api/
│       ├── _store.ts           # In-memory Map storage for mock API
│       └── documents/
│           ├── route.ts        # POST (upload) + GET (list) documents
│           └── [id]/
│               ├── route.ts    # GET document with versions
│               ├── versions/
│               │   └── route.ts # POST (create) + GET (list) versions
│               └── diff/
│                   └── route.ts # GET text + annotation diff
│
├── components/
│   ├── ui/                     # shadcn/ui primitives (button, dialog, tabs, etc.)
│   ├── pdf/
│   │   ├── PDFUploader.tsx     # Drag-drop upload zone
│   │   ├── PDFViewer.tsx       # PSPDFKit viewer with annotation events
│   │   ├── PageThumbnails.tsx  # Left sidebar page navigation
│   │   ├── AnnotationToolbar.tsx # Floating annotation tools
│   │   ├── AnnotationList.tsx  # Right sidebar annotation list
│   │   ├── ErrorBoundary.tsx   # Friendly error UI with retry
│   │   └── index.ts           # Re-exports
│   ├── version/
│   │   ├── CommitDialog.tsx    # Version commit modal
│   │   ├── VersionPanel.tsx    # Version history sidebar
│   │   ├── VersionDiff.tsx     # Full diff view with controls
│   │   └── index.ts           # Re-exports
│   └── export/
│       ├── ExportButton.tsx    # Header export button
│       └── index.ts           # Re-exports
│
├── store/
│   ├── useDocumentStore.ts     # Current document state
│   ├── useVersionStore.ts      # Version history + comparison state
│   └── useAnnotationStore.ts   # Annotation tracking + change log
│
├── lib/
│   ├── db.ts                   # Dexie IndexedDB schema + CRUD operations
│   ├── utils.ts                # shadcn cn() utility
│   ├── diff-utils.ts           # Text + annotation diff engine
│   └── pdf-utils.ts            # PDF export with cover page + callouts
│
└── types/
    └── index.ts                # All TypeScript type definitions
```

---

## API Reference

All API routes use in-memory storage (data resets on server restart). They demonstrate the contract a production backend would implement.

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `POST` | `/api/documents` | Upload PDF | `multipart/form-data` with `file` field | `201` `{ id, name, createdAt, currentVersionId, versionCount }` |
| `GET` | `/api/documents` | List documents | — | `200` `{ documents: [...] }` |
| `GET` | `/api/documents/:id` | Get document | — | `200` `{ id, name, createdAt, currentVersionId, versions: [...] }` |
| `POST` | `/api/documents/:id/versions` | Create version | `{ message, annotations?, textContent?, pdfData? }` | `201` version metadata |
| `GET` | `/api/documents/:id/versions` | List versions | — | `200` `{ versions: [...] }` |
| `GET` | `/api/documents/:id/diff?v1=X&v2=Y` | Compare versions | Query params `v1`, `v2` (version IDs) | `200` `{ textDiffs, annotationChanges, summary }` |

Error responses follow the format `{ error: "description" }` with appropriate HTTP status codes (400, 404, 500).

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / `Cmd+S` | Open commit dialog |
| `Ctrl+E` / `Cmd+E` | Export annotated PDF |

---

## Manual Testing Checklist

- [ ] Upload a PDF via drag-and-drop
- [ ] Upload a PDF via Browse Files button
- [ ] Verify page thumbnails appear in left sidebar
- [ ] Navigate pages by clicking thumbnails
- [ ] Add a highlight annotation with color picker
- [ ] Add a sticky note annotation
- [ ] Add a free text annotation
- [ ] Verify unsaved changes badge appears
- [ ] Delete an annotation with two-click confirmation
- [ ] Open commit dialog (Ctrl+S) and create a version
- [ ] Verify version appears in right sidebar
- [ ] Make more changes and create a second version
- [ ] Switch between versions (click in sidebar)
- [ ] Verify unsaved changes warning when switching
- [ ] Enter diff mode and compare two versions
- [ ] Verify text diffs show green additions, red deletions
- [ ] Verify annotation diffs show added/removed/modified
- [ ] Use Next/Previous to navigate changed pages
- [ ] Toggle legend checkboxes to filter diff types
- [ ] Exit diff mode back to viewer
- [ ] Export annotated PDF (Ctrl+E)
- [ ] Open exported PDF and verify cover page with version table
- [ ] Verify inline callout boxes on affected pages
- [ ] Collapse and expand both sidebars
- [ ] Test at 1024px width (responsive behavior)
- [ ] Test API endpoints via curl or Postman

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Key Design Decisions

1. **Local-First**: IndexedDB storage enables offline use and instant operations
2. **Immutable Versions**: Versions never modified after creation — true version control
3. **Binary Data Isolation**: PDF ArrayBuffers in IndexedDB only, never React state
4. **PSPDFKit over PDF.js**: Production-grade annotations without building from scratch
5. **shadcn/ui**: Own the component code, no dependency lock-in
6. **Mock API**: Route handlers demonstrate backend contract without infrastructure

### Known Limitations

- PSPDFKit evaluation mode shows watermark
- Large PDFs (>50MB) may impact performance
- No cloud sync (IndexedDB is browser-local)
- Mock API uses in-memory storage (data resets on restart)

---

## Future Improvements

- [ ] **Y.js Collaboration** — Real-time multi-user editing with CRDT-based conflict resolution
- [ ] **Portable Version Bundles** — Export/import complete version histories as ZIP archives
- [ ] **PDF-to-PPT Conversion** — Slide extraction for presentation workflows
- [ ] **Undo/Redo** — Full operation history with Ctrl+Z/Ctrl+Y support
- [ ] **E2E Tests with Playwright** — Automated browser tests covering full user journeys
- [ ] **HIPAA Compliance** — Encryption at rest, audit logging, data retention policies
- [ ] **Cloud Sync** — S3/R2 + PostgreSQL for cross-device access
- [ ] **Branch/Merge for Versions** — Git-like branching model for parallel review tracks
- [ ] **Full-Text Search** — Search across all versions and documents
- [ ] **Mobile App** — React Native with offline-first sync

---

## License

This project was created for a technical assessment. Code is available for review purposes.
