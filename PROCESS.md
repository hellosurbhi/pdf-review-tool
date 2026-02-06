# Development Process Log

This document tracks the development progress, decisions made, challenges encountered, and learnings throughout the project.

---

## Phase 0: Initial Project Setup

**Date:** 2026-02-06
**Duration:** ~45 minutes

### What Was Built

1. **Next.js 14 Project Initialization**
   - Created new project with App Router, TypeScript, Tailwind CSS
   - Configured path aliases (`@/*`) for clean imports
   - No ESLint initially (will add later with custom rules)

2. **Dependencies Installed**
   - `pspdfkit` - PDF viewing, editing, and annotation SDK
   - `zustand` - Lightweight state management
   - `dexie` - IndexedDB wrapper for local persistence
   - `diff-match-patch` - Text diffing algorithm
   - `pdf-lib` - PDF generation and manipulation
   - `lucide-react` - Icon library
   - `sonner` - Toast notifications

3. **shadcn/ui Setup**
   - Initialized with default configuration (Tailwind v4 compatible)
   - Added components: button, dialog, input, select, tabs, badge, separator, scroll-area, dropdown-menu, tooltip

4. **PSPDFKit Configuration**
   - Copied assets to `public/pspdfkit-lib/`
   - Added webpack config for WASM handling
   - Added CORS headers for SharedArrayBuffer support

5. **Core Architecture**
   - Type definitions in `src/types/index.ts`
   - Dexie database schema in `src/lib/db.ts`
   - Zustand stores: `useDocumentStore`, `useVersionStore`

6. **UI Layout**
   - 3-column layout: left sidebar (pages), main (viewer), right sidebar (versions)
   - Header with upload/export/settings actions
   - Collapsible sidebars with tooltips

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **shadcn/ui over custom components** | Pre-built, accessible components that integrate with Tailwind. Saves development time while maintaining full customization. |
| **Dexie for IndexedDB** | Promise-based API, handles binary blobs efficiently, built-in schema migrations. Critical for storing PDF ArrayBuffers. |
| **Zustand over Redux** | ~1KB bundle, minimal boilerplate. Two stores (document + version) stay decoupled and focused. |
| **PSPDFKit evaluation mode** | No license key needed for development. Production deployment would require license. |
| **Tailwind CSS v4** | Latest version with better performance, native CSS nesting, and improved DX. |
| **No ESLint initially** | Will add with custom configuration in Phase 1 to avoid create-next-app defaults. |

### Challenges Encountered

1. **Tailwind v4 + shadcn/ui Compatibility**
   - shadcn now uses Tailwind v4 with new CSS variables system
   - Required understanding the new `@theme` directive and CSS variable structure

2. **PSPDFKit WASM Configuration**
   - Needed webpack config to handle `canvas` and `encoding` module aliases
   - Added CORS headers for SharedArrayBuffer (required by PSPDFKit)

3. **TypeScript Strict Mode**
   - Ensured all types are properly defined without `any`
   - Created comprehensive interfaces for all data structures

### Project Structure Created

```
pdf-review-tool/
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout with Toaster
│   │   ├── page.tsx        # Main 3-column layout
│   │   └── api/documents/  # API routes (future)
│   ├── components/
│   │   ├── ui/             # shadcn components
│   │   ├── pdf/            # PDF-related components
│   │   ├── version/        # Version control components
│   │   └── export/         # Export functionality
│   ├── store/
│   │   ├── useDocumentStore.ts
│   │   └── useVersionStore.ts
│   ├── lib/
│   │   ├── db.ts           # Dexie database
│   │   └── utils.ts        # shadcn utilities
│   └── types/
│       └── index.ts        # All TypeScript types
├── public/
│   └── pspdfkit-lib/       # PSPDFKit assets (gitignored)
├── next.config.ts          # Webpack + headers config
├── PROCESS.md              # This file
├── ARCHITECTURE.md         # System design diagrams
└── README.md               # Project documentation
```

### What's Next (Phase 1)

- [x] Implement PDF upload with drag-and-drop
- [x] Integrate PSPDFKit viewer component
- [x] Add file validation (PDF only, size limits)
- [x] Create initial version on upload
- [x] Display page thumbnails in left sidebar
- [x] Toast notifications for user feedback

---

## Phase 1: PDF Upload & Viewing

**Date:** 2026-02-06
**Duration:** ~30 minutes

### What Was Built

1. **PDFUploader Component** (`src/components/pdf/PDFUploader.tsx`)
   - Drag-and-drop upload zone with visual feedback
   - File picker fallback for clicking to browse
   - File validation: PDF only, max 50MB
   - Loading state with spinner during upload
   - Creates document and initial version in IndexedDB
   - Toast notifications for success/error feedback

2. **PDFViewer Component** (`src/components/pdf/PDFViewer.tsx`)
   - Dynamically loads PSPDFKit to avoid SSR issues
   - Manages PSPDFKit instance lifecycle with proper cleanup
   - Loading state overlay while PDF loads
   - Error state display if loading fails
   - Callbacks for page changes and total pages
   - Exposes instance reference for external navigation

3. **PageThumbnails Component** (`src/components/pdf/PageThumbnails.tsx`)
   - Displays clickable page placeholders
   - Visual selection state for current page
   - Scrollable container for many pages
   - Syncs with PDF viewer navigation

4. **Main Page Integration** (`src/app/page.tsx`)
   - Upload dialog triggered from header button
   - PDF viewer renders when document is loaded
   - Page thumbnails update when PSPDFKit reports total pages
   - Bidirectional navigation: thumbnails ↔ viewer

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Dynamic import for PSPDFKit** | WebAssembly cannot be loaded during SSR; dynamic import ensures client-side only loading |
| **Separate component files** | Each component is focused and testable; index.ts provides clean re-exports |
| **Callbacks for instance communication** | Parent component can control viewer (e.g., goToPage) without tight coupling |
| **Placeholder thumbnails** | Actual PDF thumbnails require canvas rendering; placeholders work for MVP |
| **ArrayBuffer storage in IndexedDB** | PDF data never enters React state; prevents memory issues with large files |

### Challenges Encountered

1. **PSPDFKit Dynamic Import Typing**
   - TypeScript didn't recognize the default export structure
   - Fixed by casting: `pspdfkitModule.default as unknown as PSPDFKitModule`

2. **Type Sharing Between Components**
   - PSPDFKitInstanceType needed in multiple files
   - Solution: Export from PDFViewer.tsx, re-export in index.ts

3. **Instance Cleanup**
   - PSPDFKit requires explicit dispose() on unmount
   - Used isMounted flag to prevent operations after unmount

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/components/pdf/PDFUploader.tsx` | Created | Drag-drop upload dialog |
| `src/components/pdf/PDFViewer.tsx` | Created | PSPDFKit viewer wrapper |
| `src/components/pdf/PageThumbnails.tsx` | Created | Page navigation sidebar |
| `src/components/pdf/index.ts` | Created | Component re-exports |
| `src/app/page.tsx` | Modified | Integrated all PDF components |

### What's Next (Phase 2)

- [ ] Version creation with commit message
- [ ] Version switching in the sidebar
- [ ] Export PDF functionality
- [ ] Annotation tools integration

---
