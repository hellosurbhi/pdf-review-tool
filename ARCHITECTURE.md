# Architecture Documentation

This document describes the system architecture, data flow, and design decisions for the PDF Review & Versioning Tool.

## 1. High-Level Architecture

```mermaid
flowchart TB
    subgraph Browser["Browser Client"]
        subgraph UI["UI Layer (React)"]
            Header["Header Bar"]
            AnnotationToolbar["Annotation Toolbar"]
            LeftSidebar["Left Sidebar<br/>(Page Thumbnails)"]
            Viewer["PDF Viewer<br/>(PSPDFKit)"]
            RightSidebar["Right Sidebar<br/>(Versions + Annotations)"]
            DiffView["Diff View<br/>(VersionDiff)"]
            Dialogs["Dialogs & Modals"]
            ErrorBoundary["Error Boundary"]
        end

        subgraph State["State Layer (Zustand)"]
            DocStore["useDocumentStore"]
            VerStore["useVersionStore"]
            AnnStore["useAnnotationStore"]
        end

        subgraph Services["Service Layer"]
            PDFUtils["pdf-utils.ts"]
            DiffUtils["diff-utils.ts"]
            DBLayer["db.ts (Dexie)"]
        end

        subgraph External["External Libraries"]
            PSPDFKit["PSPDFKit SDK"]
            PDFLib["pdf-lib"]
            DiffMP["diff-match-patch"]
        end
    end

    subgraph Server["Next.js Server (Optional)"]
        subgraph API["Route Handlers"]
            DocAPI["POST/GET /api/documents"]
            VerAPI["POST/GET /api/documents/:id/versions"]
            DiffAPI["GET /api/documents/:id/diff"]
        end
        InMemStore["In-Memory Map Storage"]
    end

    subgraph Storage["Local Storage"]
        IDB[("IndexedDB")]
    end

    UI --> State
    State --> Services
    Services --> External
    DBLayer --> IDB
    PSPDFKit --> Viewer
    API --> InMemStore
    ErrorBoundary --> Viewer
```

## 2. Data Flow — Full User Journey

```mermaid
sequenceDiagram
    participant User
    participant Upload as PDFUploader
    participant Store as Zustand Stores
    participant DB as Dexie (IndexedDB)
    participant PSPDFKit as PSPDFKit SDK
    participant Viewer as PDFViewer
    participant Toolbar as AnnotationToolbar
    participant Commit as CommitDialog
    participant Diff as VersionDiff
    participant Export as ExportButton

    Note over User,Export: Upload Flow
    User->>Upload: Drop/Select PDF file
    Upload->>Upload: Validate file (type, size)
    Upload->>DB: documentOps.create(doc)
    Upload->>DB: versionOps.create(v1)
    Upload->>Store: setCurrentDocument + addVersion

    Note over User,Export: Viewing Flow
    Store-->>Viewer: versionId prop
    Viewer->>DB: versionOps.getPdfData(versionId)
    DB-->>Viewer: ArrayBuffer
    Viewer->>PSPDFKit: PSPDFKit.load(config)
    PSPDFKit-->>User: Render PDF

    Note over User,Export: Annotation Flow
    User->>Toolbar: Select tool (highlight, note, text, etc.)
    Toolbar->>PSPDFKit: Set interaction mode
    User->>PSPDFKit: Create/edit annotation
    PSPDFKit->>Viewer: annotations.create event
    Viewer->>Store: addAnnotation + addChange

    Note over User,Export: Commit Flow
    User->>Commit: Open dialog (Ctrl+S)
    User->>Commit: Enter message, click Commit
    Commit->>PSPDFKit: exportPDF() + exportInstantJSON()
    Commit->>PSPDFKit: textLinesForPageIndex(0..N)
    Commit->>DB: versionOps.create(version)
    Commit->>Store: addVersion + clearChanges

    Note over User,Export: Diff Flow
    User->>Diff: Select base + compare versions
    Diff->>DB: Load textContent + annotations for both
    Diff->>Diff: diff_main() per page + compare annotation IDs
    Diff-->>User: Color-coded text diffs + annotation changes

    Note over User,Export: Export Flow
    User->>Export: Click Export (Ctrl+E)
    Export->>DB: Load current PDF + all version metadata
    Export->>Export: Insert cover page + draw callouts
    Export-->>User: Download annotated PDF
```

## 3. Component Hierarchy

```mermaid
flowchart TD
    RootLayout["RootLayout"]
    HomePage["Home (page.tsx)"]

    subgraph Header["Header"]
        Logo["Logo + Title"]
        DocName["Document Name"]
        VersionBadge["Version Badge (V1, V2)"]
        UnsavedBadge["Unsaved Changes Badge"]
        Actions["Commit | Diff | Export"]
    end

    subgraph LeftSidebar["Left Sidebar (240px)"]
        PagesHeader["Pages Header + Close"]
        PageThumbnails["PageThumbnails"]
        LoadingSkeleton["Loading Skeleton"]
    end

    subgraph MainContent["Main Content"]
        ErrorBound["PDFErrorBoundary"]
        PDFViewer["PDFViewer (PSPDFKit)"]
        UploadZone["PDFUploader (Empty State)"]
    end

    subgraph DiffView["Diff Mode (replaces main layout)"]
        DiffControls["Diff Controls<br/>(base/compare selectors)"]
        DiffPanel["Per-Page Text Diffs"]
        DiffAnnotations["Annotation Changes"]
        DiffSummary["Summary + Legend + Navigation"]
    end

    subgraph RightSidebar["Right Sidebar (280px)"]
        TabVersions["Tab: Versions"]
        TabAnnotations["Tab: Annotations"]
        VersionPanel["VersionPanel"]
        AnnotationList["AnnotationList"]
        CreateVersionBtn["Create Version Button"]
    end

    subgraph Modals["Modal Components"]
        CommitDialog["CommitDialog"]
        UnsavedWarning["Unsaved Changes Warning"]
    end

    subgraph AnnotToolbar["Annotation Toolbar"]
        Pointer["Pointer"]
        Highlight["Highlight + Color Picker"]
        Note["Sticky Note"]
        FreeText["Free Text"]
        Redaction["Redaction"]
    end

    RootLayout --> HomePage
    HomePage --> Header
    HomePage --> AnnotToolbar
    HomePage --> LeftSidebar
    HomePage --> MainContent
    HomePage --> DiffView
    HomePage --> RightSidebar
    HomePage --> Modals
    MainContent --> ErrorBound
    ErrorBound --> PDFViewer
```

## 4. State Management

```mermaid
flowchart LR
    subgraph DocumentStore["useDocumentStore"]
        DS_Doc["currentDocument"]
        DS_Docs["documents[]"]
        DS_Loading["isLoading"]
        DS_Error["error"]
    end

    subgraph VersionStore["useVersionStore"]
        VS_Versions["versions[]"]
        VS_Current["currentVersionId"]
        VS_Compare["compareVersionId"]
        VS_Diff["diffResult"]
        VS_Comparing["isComparing"]
    end

    subgraph AnnotationStore["useAnnotationStore"]
        AS_Annotations["annotations[]"]
        AS_Changes["pendingChanges[]"]
    end

    subgraph IndexedDB["IndexedDB (Dexie)"]
        DB_Docs[("documents")]
        DB_Vers[("versions")]
    end

    subgraph MockAPI["Mock API (Optional)"]
        API_Store["In-Memory Map"]
    end

    DocumentStore <--> DB_Docs
    VersionStore <--> DB_Vers
    DB_Docs -.->|future sync| API_Store
    DB_Vers -.->|future sync| API_Store
```

## 5. Database / IndexedDB Schema

```mermaid
erDiagram
    DOCUMENTS {
        string id PK
        string name
        datetime createdAt
        string currentVersionId FK
    }

    VERSIONS {
        string id PK
        string documentId FK
        int versionNumber
        string message
        blob pdfData "ArrayBuffer"
        text annotations "JSON string (Instant JSON)"
        text textContent "JSON array of PageText"
        datetime createdAt
    }

    DOCUMENTS ||--o{ VERSIONS : "has many"
    DOCUMENTS ||--o| VERSIONS : "current version"
```

### Mock API In-Memory Schema

The mock backend mirrors the IndexedDB schema using `Map<string, StoredDocument>` and `Map<string, StoredVersion>`. Version responses exclude `pdfData` to keep payloads small.

## 6. Production Architecture (Scaled Up)

```mermaid
flowchart TB
    subgraph Clients["Client Layer"]
        Web["Web App<br/>(Next.js + Vercel)"]
        Mobile["Mobile App<br/>(React Native)"]
    end

    subgraph CDN["CDN Layer"]
        Static["Static Assets<br/>(Vercel Edge)"]
        PSPDFKitAssets["PSPDFKit WASM<br/>(Cloudflare R2)"]
    end

    subgraph API["API Layer"]
        Gateway["API Gateway<br/>(rate limiting, auth)"]
        Auth["Auth Service<br/>(JWT + OAuth 2.0)"]
        DocService["Document Service"]
        VersionService["Version Service"]
        DiffWorker["Diff Worker<br/>(diff-match-patch)"]
        ExportWorker["Export Worker<br/>(pdf-lib)"]
        CollabService["Collaboration Service<br/>(Y.js + WebSocket)"]
    end

    subgraph Storage["Storage Layer"]
        Postgres[("PostgreSQL<br/>Metadata + versions")]
        S3["S3 / R2<br/>PDF blob storage"]
        Redis["Redis<br/>Cache + sessions + pub/sub"]
    end

    subgraph Infrastructure["Infrastructure"]
        Queue["Job Queue<br/>(BullMQ)"]
        Monitoring["Monitoring<br/>(Prometheus + Grafana)"]
        Logging["Logging<br/>(Sentry + structured logs)"]
    end

    Clients --> CDN
    Clients --> Gateway
    Gateway --> Auth
    Gateway --> DocService
    Gateway --> VersionService
    Gateway --> DiffWorker
    Gateway --> ExportWorker
    Gateway --> CollabService
    DocService --> Postgres
    DocService --> S3
    VersionService --> Postgres
    VersionService --> S3
    DiffWorker --> Queue
    ExportWorker --> Queue
    CollabService --> Redis
    Queue --> Monitoring
    API --> Logging
```

## Key Scaling Decisions

| Concern | Current (Local-First) | Production (Cloud) |
|---------|----------------------|-------------------|
| **PDF Storage** | IndexedDB ArrayBuffer | S3/R2 with signed URLs for secure access |
| **Metadata** | IndexedDB via Dexie | PostgreSQL with proper indexing |
| **State** | Zustand (client-only) | Zustand + server state sync (React Query) |
| **Diff Computation** | Client-side (diff-match-patch) | Background worker via job queue |
| **Export Generation** | Client-side (pdf-lib) | Server-side worker for large documents |
| **Real-time Sync** | N/A (single user) | Y.js CRDT + WebSocket via Redis pub/sub |
| **Authentication** | None | JWT tokens + OAuth 2.0 SSO |
| **Rate Limiting** | None | API Gateway with per-user limits |
| **Caching** | Browser cache | Redis for session data, CDN for static assets |
| **Monitoring** | Console logs | Prometheus + Grafana, Sentry for error tracking |
| **Text Extraction** | PSPDFKit client-side | Background workers using server-side PSPDFKit |

## Performance Considerations

| Area | Strategy | Implementation |
|------|----------|----------------|
| **Bundle Size** | PSPDFKit loaded dynamically | `import('pspdfkit')` only when viewer mounts |
| **Memory** | Binary data isolation | PDF ArrayBuffers stored in IndexedDB, never in React state |
| **Rendering** | Zustand store splitting | Three independent stores prevent unnecessary re-renders |
| **Diff Speed** | Parallel computation | `Promise.all` runs text diff and annotation diff concurrently |
| **Export** | Metadata-only loading | Version changelog loads metadata without PDF blobs |
| **Page Load** | Skeleton states | Loading indicators appear immediately while async operations run |
| **Sidebar** | Transition animations | CSS `transition-all duration-200` for smooth collapse/expand |
| **Large PDFs** | Incremental rendering | PSPDFKit virtualizes page rendering; thumbnails use placeholders |

## UI Theme Strategy

The application uses a **mixed theme** approach:
- **Header**: Light background (`bg-card`) with standard foreground colors
- **Sidebars**: Dark theme (`#1a1a2e`) with slate-colored text for document navigation contrast
- **Main viewer area**: Light neutral background for optimal PDF readability
- **Diff mode**: Full-width replacement of normal layout, same light theme
- **Accents**: Blue (`blue-500`) for selection states, active pages, and current version highlighting

This avoids a full dark mode toggle while providing visual hierarchy that separates navigation (dark) from content (light).

## Upload-to-Viewer Flow

```
No Document                    Document Loaded
┌──────────────────────┐      ┌───┬──────────────┬────┐
│       Header         │      │   │   Header      │    │
├──────────────────────┤      ├───┼──────────────┼────┤
│                      │      │   │              │    │
│                      │      │ P │              │ V  │
│   Full-screen        │ ──►  │ a │  PDF Viewer  │ e  │
│   Upload Drop Zone   │      │ g │  (PSPDFKit)  │ r  │
│   (fade-in)          │      │ e │  (fade-in)   │ s  │
│                      │      │ s │              │    │
└──────────────────────┘      └───┴──────────────┴────┘
```

Sidebars only render when a document is loaded, keeping the upload screen clean and focused. Both transitions use CSS fade-in animations.

## Annotation Event Flow

```mermaid
sequenceDiagram
    participant User
    participant PSPDFKit
    participant Viewer as PDFViewer
    participant ErrorBoundary as PDFErrorBoundary
    participant Store as useAnnotationStore
    participant UI as AnnotationList + Badge

    User->>PSPDFKit: Create/edit/delete annotation
    PSPDFKit->>Viewer: annotations.create/update/delete event
    Viewer->>Viewer: Map PSPDFKit type → AnnotationType
    Viewer->>Store: addAnnotation() + addChange()
    Store-->>UI: Re-render annotation list
    Store-->>UI: Update unsaved changes badge count

    Note over ErrorBoundary,Viewer: ErrorBoundary wraps viewer<br/>catches render errors with retry UI
```

The annotation store tracks two arrays:
- `annotations[]` — current snapshot of all annotations on the document
- `pendingChanges[]` — change log since last version commit (drives the "unsaved changes" badge)

## Mock API Architecture

```mermaid
flowchart LR
    subgraph Client["Browser"]
        Frontend["React Frontend"]
        IDB[("IndexedDB")]
    end

    subgraph Server["Next.js Server"]
        subgraph Routes["Route Handlers"]
            R1["POST /api/documents"]
            R2["GET /api/documents"]
            R3["GET /api/documents/:id"]
            R4["POST /api/documents/:id/versions"]
            R5["GET /api/documents/:id/versions"]
            R6["GET /api/documents/:id/diff?v1&v2"]
        end
        Store["In-Memory Map<br/>documents + versions"]
    end

    Frontend -->|"Currently uses"| IDB
    Frontend -.->|"Future: API calls"| Routes
    Routes --> Store
```

The mock API and IndexedDB currently operate independently. The frontend uses IndexedDB directly via Dexie. The API routes demonstrate the contract a production backend would implement, enabling a future migration where the frontend swaps Dexie calls for `fetch()` calls.
