# Development Process Log

This document tracks the development progress, decisions made, challenges encountered, and learnings throughout the project.

---

## Methodology

This project was built using a **plan-first, phase-by-phase approach**:

1. **Upfront Architecture**: Before writing code, the full system was designed — component hierarchy, data flow, state management, and database schema were documented in ARCHITECTURE.md.

2. **Phased Implementation**: The project was split into 7 distinct phases (0–6), each with a clear scope. Each phase was completed and committed before moving to the next, ensuring the application was always in a working state.

3. **Convention-Driven Development**: Project conventions (import order, naming, component structure, JSDoc, `useCallback` for handlers) were established in Phase 0 and followed consistently across all phases.

4. **Build-Verify-Commit Cycle**: Every phase ended with a successful `npm run build`, ensuring no broken code was committed. TypeScript strict mode caught issues early.

5. **Documentation-Alongside-Code**: PROCESS.md, ARCHITECTURE.md, and README.md were updated with each phase, not left until the end. This ensured accuracy and provided a real-time record of decisions.

6. **Local-First Architecture**: All data operations use IndexedDB via Dexie. The mock API (Phase 6) was designed to demonstrate the production backend contract without changing the frontend's data flow.

---

## Phase 0: Initial Project Setup

**Date:** 2026-02-06

### What Was Built

1. **Next.js 14 Project Initialization**
   - Created new project with App Router, TypeScript, Tailwind CSS
   - Configured path aliases (`@/*`) for clean imports

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

### Challenges Encountered

1. **Tailwind v4 + shadcn/ui Compatibility** — Required understanding the new `@theme` directive and CSS variable structure
2. **PSPDFKit WASM Configuration** — Needed webpack config to handle `canvas` and `encoding` module aliases
3. **TypeScript Strict Mode** — All types defined without `any` from the start

---

## Phase 1: PDF Upload & Viewing

**Date:** 2026-02-06

### What Was Built

1. **PDFUploader Component** — Full-screen drag-and-drop upload zone with animated visual feedback, drag counter pattern for flicker prevention, file validation (PDF only, 50MB max), loading states, and toast notifications

2. **PDFViewer Component** — Dynamically loaded PSPDFKit SDK with full toolbar configuration (zoom, pager, search, annotation tools), proper instance lifecycle management, loading/error states, and instance reference passing

3. **PageThumbnails Component** — Clickable page navigation in dark sidebar, auto-scroll to current page, blue accent for active page

4. **Dark Sidebar Theme** — `.sidebar-dark` CSS class with #1a1a2e background, custom scrollbar styling, mixed theme approach (dark sidebars, light main area)

5. **Layout Integration** — Version badge in header, sidebars only render with document loaded, smooth transitions

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Dynamic import for PSPDFKit** | WebAssembly cannot be loaded during SSR; dynamic import ensures client-side only loading |
| **Drag counter pattern** | Using a counter instead of `dragLeave` prevents flicker when dragging over child elements |
| **PSPDFKit toolbar config** | Provides zoom, search, annotation tools out of the box without custom implementation |
| **Conditional sidebar rendering** | Upload screen shows clean without empty sidebars; sidebars appear on document load |

### Challenges Encountered

1. **PSPDFKit Dynamic Import Typing** — TypeScript didn't recognize default export; fixed with double cast
2. **Instance Cleanup** — PSPDFKit requires explicit `dispose()` on unmount; used `isMounted` flag

---

## Phase 2: Annotations and Editing Tools

**Date:** 2026-02-06

### What Was Built

1. **Annotation Change Tracking** — New `useAnnotationStore` Zustand store with `TrackedAnnotation` and `AnnotationChangeRecord` types, accumulating changes until commit

2. **PSPDFKit Annotation Events** — Listeners for `annotations.create/update/delete`, type mapping from PSPDFKit types to our enum, contents/color extraction, initial sync on load

3. **Annotation Toolbar** — Floating toolbar with Pointer, Highlight (4-color picker), Sticky Note, Free Text, and Redaction tools

4. **Annotation List** — Right sidebar showing annotations sorted by page, with type icons, color coding, click-to-navigate, and two-click deletion

5. **Unsaved Changes Badge** — Amber badge in header showing pending change count

6. **Tabbed Right Sidebar** — Versions and Annotations tabs in the right sidebar

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate annotation store** | High-frequency annotation state independent of version/document; prevents unnecessary re-renders |
| **`getState()` for event handlers** | Event handlers access latest store state without closure staleness |
| **Two-click delete** | Prevents accidental deletion without modal dialog; auto-resets after 3s |

### Challenges Encountered

1. **PSPDFKit Annotation Event Types** — Passes `Immutable.List`, not plain arrays; typed with `forEach` interface
2. **TypeScript Strict Color Extraction** — Each color channel needs individual `typeof` check

---

## Phase 3: Version History System

**Date:** 2026-02-06

### What Was Built

1. **CommitDialog Component** — Modal with auto-generated version number, required commit message, change summary (added/modified/removed counts), exports PDF + annotations (Instant JSON) + text content per page

2. **VersionPanel Component** — Reverse chronological version cards with blue accent for current, relative timestamps, annotation count badges, click-to-switch with unsaved changes warning dialog

3. **PSPDFKit Type Extensions** — Added `exportInstantJSON()`, `textLinesForPageIndex()`, and `PSPDFKitTextLine` interface

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Text extraction via textLinesForPageIndex** | Per-page text stored as JSON for future diffing |
| **exportInstantJSON for annotations** | Captures full PSPDFKit annotation state including tool-specific data |
| **Version switching via versionId prop** | PDFViewer reactively reloads when prop changes |
| **Relative timestamps** | More user-friendly than absolute dates |

---

## Phase 4: Version Diff System

**Date:** 2026-02-06

### What Was Built

1. **Diff Engine** (`diff-utils.ts`) — `computeTextDiff()` with diff-match-patch per page, `computeAnnotationDiff()` comparing by annotation ID, `computeFullDiff()` running both in parallel

2. **VersionDiff Component** — Two dropdown selectors, Compare button, per-page text diff panels with green additions/red deletions, annotation change entries, summary panel with total/per-type stats, prev/next navigation, legend with toggle checkboxes

3. **Type Updates** — Enhanced `TextDiff` with `hasChanges`/`addedCount`/`removedCount`, added `AnnotationDiffResult` and `AnnotationDiffEntry`

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Per-page diff panel** | PDF coordinate positioning unreliable across versions; panel provides accurate diffs |
| **diff-match-patch with cleanupSemantic** | Semantic cleanup groups related changes for readability |
| **Parallel diff computation** | `Promise.all` halves computation time for independent operations |
| **Diff mode replaces layout** | Full width needed for readable diffs |
| **Inline diff (not side-by-side)** | Shows additions and deletions in context |

### Challenges Encountered

1. **diff-match-patch Import** — CommonJS default export works with `@types/diff-match-patch`
2. **Annotation JSON Parsing** — Handles both Instant JSON format and plain arrays

---

## Phase 5: Export Annotated PDF

**Date:** 2026-02-06

### What Was Built

1. **Export Engine** (`pdf-utils.ts`) — Loads current PDF via `PDFDocument.load()`, inserts cover page with version history table (dark header row, alternating backgrounds, truncated messages), adds inline callout boxes on affected pages (150x20, light blue, stacked vertically), triggers download

2. **ExportButton Component** — Header button with loading spinner, disabled when only V1 exists, tooltip explains state, success/error toasts

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **pdf-lib over PSPDFKit export** | Pure JS enables custom cover pages and callout graphics |
| **Cover page at index 0** | Change log is first thing reviewer sees |
| **Callout offset by +1** | Account for inserted cover page shifting original pages |
| **Fonts embedded at doc level** | `embedFont()` called once, passed to draw functions |
| **Metadata-only version loading** | Only current version's PDF blob loaded; others get empty ArrayBuffer |

### Challenges Encountered

1. **PDFDocument Private Constructor** — `InstanceType<typeof PDFDocument>` fails; used `PDFDocument` directly as type
2. **Uint8Array / BlobPart** — TypeScript strict mode requires `pdfBytes.buffer as ArrayBuffer` for Blob constructor

---

## Phase 6: Mock Backend API + UI Polish

**Date:** 2026-02-06

### What Was Built

1. **Mock Backend API** (Next.js Route Handlers)
   - `_store.ts` — In-memory `Map<string, StoredDocument>` and `Map<string, StoredVersion>` with helper methods
   - `POST /api/documents` — Accept multipart/form-data PDF upload, validate type/size, store in memory, return metadata (201)
   - `GET /api/documents` — Return all documents sorted by creation date
   - `GET /api/documents/:id` — Return document with full version list (404 if not found)
   - `POST /api/documents/:id/versions` — Create version with message + optional annotations/textContent/pdfData (base64), auto-increment version number (201)
   - `GET /api/documents/:id/versions` — Return all versions for document
   - `GET /api/documents/:id/diff?v1=X&v2=Y` — Compute text diff (diff-match-patch per page) and annotation diff (by ID comparison) between two versions
   - All routes include proper HTTP status codes (201/200/400/404/500), TypeScript types for request/response, and error handling

2. **UI Polish**
   - **Fade Transitions** — CSS `animate-in fade-in` animations on upload→viewer and document loading states
   - **Loading Skeletons** — Pulse animations in page thumbnail sidebar and document loading state
   - **Empty States** — Icon + message for: "No versions yet" (History icon + helpful CTA), "No annotations yet" (MessageSquare icon + toolbar hint), "Loading pages..." (pulse skeleton)
   - **Keyboard Shortcuts** — `Ctrl+S` / `Cmd+S` opens commit dialog, `Ctrl+E` / `Cmd+E` triggers export (via custom DOM event from page.tsx to ExportButton)
   - **Error Boundary** — `PDFErrorBoundary` class component wrapping PDFViewer with "Something went wrong" UI, error message display, and retry button
   - **Favicon** — SVG document icon with "PDF" text, dark theme matching sidebar
   - **Page Title** — "PDF Review Tool" with description in metadata
   - **Responsive Layout** — `min-w-[768px]` on root container, `hidden sm:inline` for button labels on smaller screens, collapsible sidebars
   - **Tooltips** — All icon buttons in header have keyboard shortcut hints in tooltips (e.g., "Create a new version (Ctrl+S)")

3. **Documentation Finalization**
   - README.md — Professional format with features table, tech stack justifications, quick start, API reference, keyboard shortcuts, testing checklist, future improvements
   - ARCHITECTURE.md — 6 accurate Mermaid diagrams (high-level, data flow, component hierarchy, state management, DB schema, production scaling) + Key Scaling Decisions table + Performance Considerations table + Mock API Architecture diagram
   - PROCESS.md — All 7 phases documented with decisions/challenges, Methodology section, Retrospective section

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **In-memory Map storage** | Simplest mock that demonstrates the API contract without infrastructure overhead |
| **Separate `_store.ts` file** | Singleton pattern ensures all route handlers share the same data |
| **Custom DOM event for keyboard export** | Clean separation — page.tsx handles keyboard events, ExportButton handles export logic |
| **CSS animation over library** | Simple `@keyframes fadeIn` avoids adding another dependency for basic transitions |
| **Class-based ErrorBoundary** | React error boundaries require `getDerivedStateFromError` which only works with class components |
| **SVG favicon** | No build step needed, scales to any size, matches dark theme |
| **`params` as Promise** | Next.js 16 requires `await params` in route handlers (breaking change from Next.js 14) |

### Challenges Encountered

1. **Next.js 16 Route Handler Params** — `params` is now a `Promise<{ id: string }>` requiring `await`; different from Next.js 14's synchronous access

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/_store.ts` | Created | In-memory Map storage with types and helpers |
| `src/app/api/documents/route.ts` | Created | POST (upload) + GET (list) documents |
| `src/app/api/documents/[id]/route.ts` | Created | GET document with version list |
| `src/app/api/documents/[id]/versions/route.ts` | Created | POST (create) + GET (list) versions |
| `src/app/api/documents/[id]/diff/route.ts` | Created | GET text + annotation diff |
| `src/components/pdf/ErrorBoundary.tsx` | Created | Error boundary with retry UI |
| `src/components/pdf/index.ts` | Modified | Added PDFErrorBoundary export |
| `src/components/export/ExportButton.tsx` | Modified | Added keyboard shortcut listener |
| `src/components/version/VersionPanel.tsx` | Modified | Enhanced empty state with icon |
| `src/app/page.tsx` | Modified | Keyboard shortcuts, fade transitions, error boundary, responsive |
| `src/app/layout.tsx` | Modified | Favicon metadata |
| `src/app/globals.css` | Modified | Fade-in animation keyframes |
| `src/app/favicon.svg` | Created | PDF document icon |
| `public/favicon.svg` | Created | Copy for static serving |
| `README.md` | Rewritten | Professional open-source format |
| `ARCHITECTURE.md` | Rewritten | 6 Mermaid diagrams + scaling tables |
| `PROCESS.md` | Finalized | All phases + methodology + retrospective |

---

## Retrospective

### What Went Well

1. **Phased approach kept scope manageable** — Each phase had a clear goal and was independently testable. No phase took longer than expected because scope was well-defined upfront.

2. **TypeScript strict mode prevented bugs** — Several type errors (PDFDocument private constructor, Uint8Array/BlobPart incompatibility, PSPDFKit event types) were caught at compile time rather than runtime. The upfront investment in comprehensive types paid off in every phase.

3. **Local-first architecture simplified development** — No backend infrastructure to manage. IndexedDB via Dexie provided instant operations, and the architecture naturally supports offline use.

4. **PSPDFKit's annotation system was powerful** — Built-in annotation tools, Instant JSON export, and text extraction saved significant development time. The evaluation mode watermark is the only downside.

5. **Zustand + Dexie pattern worked well** — Metadata in Zustand for reactivity, binary data in IndexedDB for performance. Three independent stores prevented re-render cascades.

6. **Convention-driven development reduced decision fatigue** — Established import order, component structure, and naming patterns once in Phase 0, then followed them consistently. Code review would find high consistency across all files.

### What I'd Do Differently

1. **Start with PSPDFKit type definitions** — I spent time iterating on the `PSPDFKitInstanceType` interface across phases. Creating a comprehensive type file upfront would have been cleaner.

2. **Use React Query for async operations** — The current approach uses manual loading states. React Query would provide caching, deduplication, and automatic retry out of the box.

3. **Add unit tests earlier** — The diff engine and PDF export utilities have pure function signatures that are straightforward to test. Adding tests alongside implementation would have caught edge cases faster.

4. **Consider server-side diff computation** — For large documents, running diff-match-patch on every page in the browser can be slow. The mock API's diff endpoint shows this could be offloaded to the server.

5. **Implement proper state persistence** — Currently, refreshing the page requires re-uploading. Zustand's `persist` middleware could hydrate from IndexedDB on page load.

### If I Had Another Week

1. **Y.js Real-time Collaboration** — Add a Y.js provider with WebSocket backend for multi-user annotation sessions. Each user would see cursor positions and annotation changes in real-time.

2. **Playwright E2E Tests** — Full user journey tests: upload → annotate → commit → diff → export. Would catch regressions in the PSPDFKit integration that unit tests can't reach.

3. **Cloud Sync** — Replace IndexedDB with a Supabase backend (PostgreSQL for metadata, S3 for PDFs). Add authentication with GitHub OAuth.

4. **Undo/Redo** — Implement a command pattern tracking all annotation operations, with Ctrl+Z/Y to traverse the history stack.

5. **Portable Version Bundles** — Export/import complete version histories as ZIP files containing PDFs + metadata JSON. Enables sharing reviews across teams without a server.

---
