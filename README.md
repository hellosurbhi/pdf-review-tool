# 📄 PDF Review & Versioning Tool

> A full-featured PDF review platform with version control, visual diffing, and annotated export — built as a pure frontend Next.js application with local-first architecture.

![PDF Review Tool Screenshot](./docs/screenshot-placeholder.png)

**[📖 Architecture](./ARCHITECTURE.md)** · **[📝 Process Log](./PROCESS.md)**

---

## ✨ Features

### Upload & Viewing
| Feature | Status | Description |
|---------|--------|-------------|
| Full-screen upload zone | ✅ Implemented | Drag-drop with animated visual feedback, Browse Files button |
| PDF rendering | ✅ Implemented | High-fidelity rendering via PSPDFKit SDK |
| Page thumbnails | ✅ Implemented | Visual navigation in dark-themed left sidebar |
| Zoom & pan controls | ✅ Implemented | PSPDFKit toolbar with zoom, pager, search |
| Annotation toolbar | ✅ Implemented | Ink, highlighter, text-highlighter, notes, text tools |
| Text selection | ✅ Implemented | Select and copy text from PDFs |
| Search | ✅ Implemented | PSPDFKit search with hit count and prev/next |
| Dark sidebars | ✅ Implemented | #1a1a2e sidebar theme with lighter main area |
| Version badge | ✅ Implemented | Shows current version (V1) in header |
| Responsive layout | ✅ Implemented | Collapsible sidebars, smooth transitions |

### Editing & Annotations
| Feature | Status | Description |
|---------|--------|-------------|
| Highlight text | ✅ Implemented | PSPDFKit text-highlighter tool in toolbar |
| Add notes | ✅ Implemented | PSPDFKit note annotation tool |
| Freetext annotations | ✅ Implemented | PSPDFKit text tool in toolbar |
| Ink drawing | ✅ Implemented | PSPDFKit ink tool in toolbar |
| Text editing | 📋 Planned | Direct text modification |
| Redaction | 📋 Planned | Permanently remove content |

### Version Control
| Feature | Status | Description |
|---------|--------|-------------|
| Create versions | ✅ Implemented | Commit current state with message |
| Version history | ✅ Implemented | Timeline in right sidebar |
| Switch versions | 🔄 In Progress | Load any previous version |
| Version metadata | ✅ Implemented | Timestamp, message, annotation count |

### Diff & Compare
| Feature | Status | Description |
|---------|--------|-------------|
| Select versions to compare | ✅ Implemented | Pick any two versions |
| Text diff | 📋 Planned | Show text changes between versions |
| Annotation diff | 📋 Planned | Show annotation changes |
| Visual diff overlay | 📋 Planned | Side-by-side comparison |

### Export
| Feature | Status | Description |
|---------|--------|-------------|
| Export PDF | 📋 Planned | Download with/without annotations |
| Flattened export | 📋 Planned | Burn annotations into PDF |
| Annotated changelog | 📋 Planned | PDF with version history |

### Backend / Storage
| Feature | Status | Description |
|---------|--------|-------------|
| IndexedDB persistence | ✅ Implemented | Offline-first local storage |
| Document CRUD | ✅ Implemented | Create, read, delete documents |
| Version storage | ✅ Implemented | Full version history in DB |

**Legend:** ✅ Implemented · 🔄 In Progress · 📋 Planned

---

## 🏗️ Tech Stack

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **[Next.js 14](https://nextjs.org/)** | Framework | App Router with React Server Components support; though client-heavy, enables future SSR/API routes |
| **[TypeScript](https://www.typescriptlang.org/)** | Type Safety | Strict mode catches bugs early; comprehensive types serve as documentation |
| **[Tailwind CSS v4](https://tailwindcss.com/)** | Styling | Native CSS nesting, better performance, utility-first approach |
| **[shadcn/ui](https://ui.shadcn.com/)** | Components | Accessible, customizable primitives that own the code; no external dependency lock-in |
| **[PSPDFKit](https://pspdfkit.com/)** | PDF Engine | Production-grade rendering + annotations; PDF.js lacks annotation UX out of the box |
| **[Zustand](https://zustand-demo.pmnd.rs/)** | State | ~1KB, zero boilerplate vs Redux; two focused stores (document + version) |
| **[Dexie](https://dexie.org/)** | IndexedDB | Promise-based API, handles binary blobs efficiently, schema migrations built-in |
| **[pdf-lib](https://pdf-lib.js.org/)** | PDF Manipulation | Pure JS for merging/extracting pages without server |
| **[diff-match-patch](https://github.com/google/diff-match-patch)** | Diffing | Google's battle-tested algorithm for text comparison |
| **[Lucide React](https://lucide.dev/)** | Icons | Tree-shakeable, consistent design, lighter than FontAwesome |
| **[Sonner](https://sonner.emilkowal.ski/)** | Toasts | Beautiful, accessible notifications with minimal API |

---

## 🚀 Quick Start

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

## 📐 Architecture Overview

The application follows a **local-first architecture** — all data lives in IndexedDB, enabling offline functionality and instant operations.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser Client                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌─────────────────────────────┐  ┌────────────────┐ │
│  │  Left    │  │                             │  │     Right      │ │
│  │ Sidebar  │  │       PDF Viewer            │  │    Sidebar     │ │
│  │ (Pages)  │  │      (PSPDFKit)             │  │  (Versions)    │ │
│  │  240px   │  │                             │  │    280px       │ │
│  └──────────┘  └─────────────────────────────┘  └────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                      State Layer (Zustand)                          │
│  ┌─────────────────────────┐    ┌─────────────────────────┐        │
│  │   useDocumentStore      │    │    useVersionStore      │        │
│  │   • currentDocument     │    │    • versions[]         │        │
│  │   • isLoading           │    │    • diffResult         │        │
│  └─────────────────────────┘    └─────────────────────────┘        │
├─────────────────────────────────────────────────────────────────────┤
│                    Persistence Layer (Dexie)                        │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │  documents   │  │   versions   │                                │
│  └──────────────┘  └──────────────┘                                │
│                        IndexedDB                                    │
└─────────────────────────────────────────────────────────────────────┘
```

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for detailed diagrams including data flow, component hierarchy, and production scaling.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with Toaster
│   ├── page.tsx            # Main 3-column layout
│   ├── globals.css         # Tailwind + shadcn styles
│   └── api/documents/      # API routes (future)
│
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── pdf/                # PDFViewer, Uploader, Thumbnails
│   ├── version/            # VersionPanel, CommitDialog, DiffViewer
│   └── export/             # ExportDialog, ExportButton
│
├── store/
│   ├── useDocumentStore.ts # Document state
│   └── useVersionStore.ts  # Version history state
│
├── lib/
│   ├── db.ts               # Dexie IndexedDB schema
│   ├── utils.ts            # shadcn utilities
│   ├── pdf-utils.ts        # PDF operations (future)
│   └── diff-utils.ts       # Version comparison (future)
│
└── types/
    └── index.ts            # All TypeScript definitions
```

---

## 🧪 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## 🔧 Key Design Decisions

1. **Local-First**: IndexedDB storage enables offline use and instant operations
2. **Immutable Versions**: Versions never modified after creation — true version control
3. **Binary Data Isolation**: PDF ArrayBuffers in IndexedDB only, never React state
4. **PSPDFKit over PDF.js**: Production-grade annotations without building from scratch
5. **shadcn/ui**: Own the component code, no dependency lock-in

### Known Limitations

- PSPDFKit evaluation mode shows watermark
- Large PDFs (>50MB) may impact performance
- No cloud sync (IndexedDB is browser-local)

---

## 🚧 Future Improvements

- [ ] Cloud sync option (S3/R2 + PostgreSQL)
- [ ] Real-time collaboration (WebSocket)
- [ ] Branch/merge for versions
- [ ] Full-text search within documents
- [ ] Batch operations for multiple PDFs
- [ ] Mobile app (React Native)

---

## 📄 License

This project was created for a technical assessment. Code is available for review purposes.
