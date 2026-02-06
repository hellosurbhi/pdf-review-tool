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

## Phase 1.1: Upload & Viewer Polish

**Date:** 2026-02-06

### What Was Built

1. **Full-Screen Upload Zone** (`src/components/pdf/PDFUploader.tsx`)
   - Replaced dialog-based upload with full-screen inline drop zone
   - Animated drag feedback: dashed border turns solid blue, icon bounces
   - Drag counter prevents flicker when dragging over child elements
   - Centered polished UI with "Browse Files" CTA button
   - Loading state with spinner while processing document
   - Correct toast: "Document uploaded — Version 1 created"

2. **Enhanced PDF Viewer** (`src/components/pdf/PDFViewer.tsx`)
   - Full PSPDFKit toolbar configuration: zoom, pager, search, annotation tools
   - Toolbar items: sidebar-thumbnails, bookmarks, pager, zoom controls, search, annotate, ink, highlighter, text-highlighter, note, text, print
   - Text selection enabled via `disableTextSelection: false`
   - PSPDFKit's built-in thumbnail sidebar available via toolbar toggle
   - Improved error state with AlertTriangle icon and reload button

3. **Dark Sidebar Theme** (`src/app/globals.css`)
   - Added `.sidebar-dark` CSS class with `#1a1a2e` background
   - Custom scrollbar styling for dark sidebars
   - Both left (page thumbnails) and right (version history) sidebars use dark theme

4. **Layout Improvements** (`src/app/page.tsx`)
   - Version badge ("V1") displayed in header next to document name
   - Commit button and Export button in header (disabled, wired for Phase 2)
   - Sidebars only render when a document is loaded (clean upload screen)
   - Smooth transitions between upload zone and viewer
   - Dark-themed sidebars with slate color text for readability

5. **Page Thumbnails Update** (`src/components/pdf/PageThumbnails.tsx`)
   - Styled for dark sidebar: white/10 borders, slate text colors
   - Active page scrolls into view automatically
   - Blue accent border and background for current page

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Inline upload instead of dialog** | Full-screen drop zone matches spec; more inviting UX when no document is loaded |
| **Drag counter pattern** | Using a counter instead of `dragLeave` prevents flicker when dragging over child elements |
| **PSPDFKit toolbar config** | Provides zoom, search, annotation tools out of the box without custom implementation |
| **`.sidebar-dark` CSS class** | Achieves mixed theme (dark sidebars, light main area) without full dark mode toggle |
| **Conditional sidebar rendering** | Upload screen shows clean without empty sidebars; sidebars appear on document load |

### Files Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/components/pdf/PDFUploader.tsx` | Rewritten | Full-screen drop zone with animations |
| `src/components/pdf/PDFViewer.tsx` | Enhanced | PSPDFKit toolbar/search/annotation config |
| `src/components/pdf/PageThumbnails.tsx` | Updated | Dark sidebar styling, auto-scroll |
| `src/app/page.tsx` | Rewritten | Version badge, commit button, dark sidebars |
| `src/app/globals.css` | Updated | Added sidebar-dark theme class |

---

## Phase 2: Annotations and Editing Tools

**Date:** 2026-02-06

### What Was Built

1. **Annotation Change Tracking** (`src/store/useAnnotationStore.ts`)
   - New Zustand store for tracking annotations and pending changes
   - `TrackedAnnotation` type normalizes PSPDFKit annotations into our format
   - `AnnotationChangeRecord` tracks each create/update/delete action
   - `useUnsavedChangeCount()` selector for unsaved change badge
   - Changes accumulate until cleared by a version commit

2. **PSPDFKit Annotation Events** (`src/components/pdf/PDFViewer.tsx`)
   - Listens to `annotations.create`, `annotations.update`, `annotations.delete`
   - Maps PSPDFKit annotation types to our `AnnotationType` enum
   - Extracts contents, color, page index from PSPDFKit annotations
   - Syncs all existing annotations on initial load
   - Records every change as an `AnnotationChangeRecord`

3. **Annotation Toolbar** (`src/components/pdf/AnnotationToolbar.tsx`)
   - Floating toolbar below header with annotation tools
   - Tools: Pointer (select), Highlight (with 4-color picker dropdown), Sticky Note, Free Text, Redaction
   - Active tool gets highlighted/selected state (`bg-primary/10`)
   - Color picker shows yellow, green, blue, pink options
   - Active color indicator when highlight tool is selected
   - Communicates with PSPDFKit via contentDocument button clicks

4. **Annotation List** (`src/components/pdf/AnnotationList.tsx`)
   - Right sidebar component listing all annotations
   - Each entry shows: type icon (color-coded), page number, preview text
   - Click navigates viewer to annotation's page
   - Delete with two-click confirmation (3s auto-reset timeout)
   - Sorted by page index, then creation date
   - Empty state with "No annotations yet" message

5. **"Unsaved Changes" Badge** (`src/app/page.tsx`)
   - Amber badge in header shows count of pending changes
   - Appears when annotation changes exist since last commit
   - Tooltip explains: "Commit to save these changes as a new version"

6. **Tabbed Right Sidebar** (`src/app/page.tsx`)
   - Right sidebar now has Versions and Annotations tabs
   - Annotation tab shows count badge
   - Clean tab switching within dark sidebar theme

7. **Type System Updates** (`src/types/index.ts`)
   - Added `TrackedAnnotation` interface for normalized annotations
   - Added `AnnotationChangeRecord` for change tracking
   - Added `AnnotationState` store interface

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate annotation store** | Annotation state is high-frequency and independent of version/document state; separate store prevents unnecessary re-renders |
| **Direct store access via `getState()`** | Event handlers access `useAnnotationStore.getState()` instead of closures to always read latest state |
| **PSPDFKit type mapping** | Normalize PSPDFKit's diverse annotation types into our 5-enum `AnnotationType` for simpler tracking |
| **Two-click delete with timeout** | Prevents accidental deletion without a modal dialog; auto-resets after 3 seconds |
| **Tabbed sidebar** | Keeps version history and annotations in one panel without doubling sidebar width |
| **Color extraction from PSPDFKit** | Convert PSPDFKit's `{ r, g, b }` color objects to hex strings for storage |

### Challenges Encountered

1. **PSPDFKit Annotation Event Types**
   - PSPDFKit passes `Immutable.List` objects in event callbacks, not plain arrays
   - Handled by typing as interface with `forEach` method

2. **TypeScript Strict Color Extraction**
   - `color.g` and `color.b` needed individual `typeof` checks, not just checking `color.r`
   - Fixed by adding explicit type guards for all three color channels

3. **Toolbar ↔ PSPDFKit Communication**
   - PSPDFKit's interaction mode API varies by license; used contentDocument approach as fallback
   - Built-in toolbar buttons still available for users who prefer them

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modified | Added TrackedAnnotation, AnnotationChangeRecord, AnnotationState |
| `src/store/useAnnotationStore.ts` | Created | Annotation tracking Zustand store |
| `src/components/pdf/PDFViewer.tsx` | Modified | Annotation event listeners, type mapping |
| `src/components/pdf/AnnotationToolbar.tsx` | Created | Floating annotation tool bar |
| `src/components/pdf/AnnotationList.tsx` | Created | Sidebar annotation list with navigation |
| `src/components/pdf/index.ts` | Modified | Added new component exports |
| `src/app/page.tsx` | Modified | Toolbar integration, tabbed sidebar, unsaved badge |

### What's Next (Phase 3)

- [ ] Version creation with commit message dialog
- [ ] Version switching and loading
- [ ] Diff/comparison between versions
- [ ] Export PDF functionality

---
