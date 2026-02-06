# Architecture Documentation

This document describes the system architecture, data flow, and design decisions for the PDF Review & Versioning Tool.

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Browser["Browser Client"]
        subgraph UI["UI Layer (React)"]
            Header["Header Bar"]
            LeftSidebar["Left Sidebar<br/>(Page Thumbnails)"]
            Viewer["PDF Viewer<br/>(PSPDFKit)"]
            RightSidebar["Right Sidebar<br/>(Version History)"]
            Dialogs["Dialogs & Modals"]
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

    subgraph Storage["Local Storage"]
        IDB[("IndexedDB")]
    end

    UI --> State
    State --> Services
    Services --> External
    DBLayer --> IDB
    PSPDFKit --> Viewer
```

## Data Flow - Document Upload

```mermaid
sequenceDiagram
    participant User
    participant UI as Upload Component
    participant Store as useDocumentStore
    participant DB as Dexie (IndexedDB)
    participant PSPDFKit

    User->>UI: Drop/Select PDF file
    UI->>UI: Validate file (type, size)
    UI->>Store: setLoading(true)
    UI->>DB: documentOps.create(doc)
    DB-->>UI: Document ID
    UI->>DB: versionOps.create(v1)
    DB-->>UI: Version ID
    UI->>Store: setCurrentDocument(doc)
    UI->>Store: addVersion(v1)
    Store-->>PSPDFKit: Load PDF data
    PSPDFKit-->>UI: Render PDF
    UI->>Store: setLoading(false)
    UI->>User: Show success toast
```

## Data Flow - Version Creation

```mermaid
sequenceDiagram
    participant User
    participant UI as Commit Dialog
    participant Store as useVersionStore
    participant PSPDFKit
    participant DB as Dexie (IndexedDB)

    User->>UI: Click "Create Version"
    UI->>UI: Open commit dialog
    User->>UI: Enter commit message
    User->>UI: Confirm
    UI->>PSPDFKit: exportPDF()
    PSPDFKit-->>UI: ArrayBuffer (PDF data)
    UI->>PSPDFKit: exportInstantJSON()
    PSPDFKit-->>UI: Annotation JSON
    UI->>PSPDFKit: textLinesForPageIndex(0..N)
    PSPDFKit-->>UI: Text per page
    UI->>DB: versionOps.create(version)
    DB-->>UI: Version ID
    UI->>Store: addVersion(version)
    UI->>Store: clearChanges()
    UI->>User: Show success toast
```

## Data Flow - Version Switching

```mermaid
sequenceDiagram
    participant User
    participant UI as Version Panel
    participant Store as useVersionStore
    participant AnnStore as useAnnotationStore
    participant Viewer as PDFViewer
    participant DB as Dexie (IndexedDB)

    User->>UI: Click version card
    alt Has unsaved changes
        UI->>UI: Show warning dialog
        User->>UI: Confirm discard
        UI->>AnnStore: clearChanges()
    end
    UI->>Store: setCurrentVersion(id)
    Store-->>Viewer: versionId prop changes
    Viewer->>DB: versionOps.getPdfData(id)
    DB-->>Viewer: ArrayBuffer
    Viewer->>Viewer: Reload PSPDFKit instance
    Viewer->>AnnStore: syncAnnotations()
    Viewer->>User: Show info toast
```

## Data Flow - Version Comparison

```mermaid
sequenceDiagram
    participant User
    participant UI as Version Panel
    participant Store as useVersionStore
    participant DiffUtils as diff-utils.ts
    participant DB as Dexie (IndexedDB)

    User->>UI: Select version to compare
    UI->>Store: setCompareVersion(id)
    UI->>DB: Get both versions data
    DB-->>UI: Version A & B data
    UI->>DiffUtils: compareVersions(vA, vB)
    DiffUtils->>DiffUtils: diffText(textA, textB)
    DiffUtils->>DiffUtils: diffAnnotations(annA, annB)
    DiffUtils-->>UI: DiffResult
    UI->>Store: setDiffResult(result)
    Store-->>UI: Update diff view
```

## Component Hierarchy

```mermaid
flowchart TD
    RootLayout["RootLayout"]
    HomePage["Home (page.tsx)"]

    subgraph Header["Header"]
        Logo["Logo + Title"]
        DocName["Document Name"]
        Actions["Upload | Export | Settings"]
    end

    subgraph LeftSidebar["Left Sidebar (240px)"]
        PagesHeader["Pages Header"]
        PageThumbnails["PageThumbnails"]
    end

    subgraph MainContent["Main Content"]
        PDFViewer["PDFViewer (PSPDFKit)"]
        EmptyState["Empty State"]
    end

    subgraph RightSidebar["Right Sidebar (280px)"]
        VersionHeader["Version Header"]
        VersionList["VersionList"]
        CreateVersionBtn["Create Version Button"]
    end

    subgraph Modals["Modal Components"]
        UploadDialog["UploadDialog"]
        CommitDialog["CommitDialog"]
        ExportDialog["ExportDialog"]
        DiffViewer["DiffViewer"]
    end

    RootLayout --> HomePage
    HomePage --> Header
    HomePage --> LeftSidebar
    HomePage --> MainContent
    HomePage --> RightSidebar
    HomePage --> Modals
```

## State Management

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

    DocumentStore <--> DB_Docs
    VersionStore <--> DB_Vers
```

## Database Schema

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
        text annotations "JSON string"
        text textContent "Extracted text"
        datetime createdAt
    }

    DOCUMENTS ||--o{ VERSIONS : "has many"
    DOCUMENTS ||--o| VERSIONS : "current version"
```

## Type Definitions

```mermaid
classDiagram
    class PDFDocument {
        +string id
        +string name
        +Date createdAt
        +string? currentVersionId
    }

    class Version {
        +string id
        +string documentId
        +int versionNumber
        +string message
        +ArrayBuffer pdfData
        +string annotations
        +string textContent
        +Date createdAt
    }

    class Annotation {
        +string id
        +AnnotationType type
        +int pageIndex
        +AnnotationRect rect
        +string? contents
        +string? color
        +Date createdAt
    }

    class DiffResult {
        +string versionAId
        +string versionBId
        +TextDiff[] textDiffs
        +AnnotationChange[] annotationChanges
        +DiffSummary summary
    }

    class AnnotationType {
        <<enumeration>>
        HIGHLIGHT
        NOTE
        FREETEXT
        REDACTION
        TEXT_EDIT
    }

    PDFDocument "1" --> "*" Version
    Version "1" --> "*" Annotation
    DiffResult --> Version
    Annotation --> AnnotationType
```

## Production Architecture (Scaled Up)

For a production deployment with cloud sync and collaboration:

```mermaid
flowchart TB
    subgraph Clients["Client Layer"]
        Web["Web App<br/>(Next.js)"]
        Mobile["Mobile App<br/>(React Native)"]
    end

    subgraph CDN["CDN Layer"]
        Static["Static Assets"]
        PSPDFKitAssets["PSPDFKit Assets"]
    end

    subgraph API["API Layer"]
        Gateway["API Gateway"]
        Auth["Auth Service<br/>(JWT/OAuth)"]
        DocService["Document Service"]
        VersionService["Version Service"]
        SyncService["Sync Service<br/>(WebSocket)"]
    end

    subgraph Storage["Storage Layer"]
        Postgres[("PostgreSQL<br/>Metadata")]
        S3["S3/R2<br/>PDF Storage"]
        Redis["Redis<br/>Cache + Sessions"]
    end

    subgraph Processing["Processing Layer"]
        Queue["Job Queue<br/>(Bull/BullMQ)"]
        TextExtract["Text Extraction<br/>Worker"]
        Thumbnail["Thumbnail<br/>Generator"]
    end

    Clients --> CDN
    Clients --> Gateway
    Gateway --> Auth
    Gateway --> DocService
    Gateway --> VersionService
    Gateway --> SyncService
    DocService --> Postgres
    DocService --> S3
    VersionService --> Postgres
    VersionService --> S3
    SyncService --> Redis
    DocService --> Queue
    Queue --> TextExtract
    Queue --> Thumbnail
```

### Production Considerations

| Concern | Solution |
|---------|----------|
| **PDF Storage** | S3/R2 for scalable blob storage, signed URLs for secure access |
| **Real-time Sync** | WebSocket connections via Redis pub/sub for collaboration |
| **Text Extraction** | Background workers using pdf.js or server-side PSPDFKit |
| **Caching** | Redis for session data, CDN for static assets |
| **Authentication** | JWT tokens with refresh, OAuth for SSO |
| **Rate Limiting** | API Gateway with per-user limits |
| **Monitoring** | Prometheus + Grafana, error tracking with Sentry |

## Key Design Principles

1. **Local-First**: All data stored in IndexedDB for offline capability
2. **Immutable Versions**: Versions are never modified after creation
3. **Binary Data Isolation**: PDF ArrayBuffers never stored in React state
4. **Type Safety**: Comprehensive TypeScript types, no `any`
5. **Component Isolation**: Each component has single responsibility
6. **Lazy Loading**: PSPDFKit loaded dynamically to reduce bundle size

## UI Theme Strategy

The application uses a **mixed theme** approach:
- **Header**: Light background (`bg-card`) with standard foreground colors
- **Sidebars**: Dark theme (`#1a1a2e`) with slate-colored text for document navigation contrast
- **Main viewer area**: Light neutral background for optimal PDF readability
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
│                      │      │ e │              │ s  │
│                      │      │ s │              │    │
└──────────────────────┘      └───┴──────────────┴────┘
```

Sidebars only render when a document is loaded, keeping the upload screen clean and focused.

## Annotation Event Flow

```mermaid
sequenceDiagram
    participant User
    participant PSPDFKit
    participant Viewer as PDFViewer
    participant Store as useAnnotationStore
    participant UI as AnnotationList + Badge

    User->>PSPDFKit: Create/edit/delete annotation
    PSPDFKit->>Viewer: annotations.create/update/delete event
    Viewer->>Viewer: Map PSPDFKit type → AnnotationType
    Viewer->>Store: addAnnotation() + addChange()
    Store-->>UI: Re-render annotation list
    Store-->>UI: Update unsaved changes badge count
```

The annotation store tracks two arrays:
- `annotations[]` — current snapshot of all annotations on the document
- `pendingChanges[]` — change log since last version commit (drives the "unsaved changes" badge)
