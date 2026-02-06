/**
 * Core type definitions for PDF Review & Versioning Tool
 */

/**
 * Annotation types supported by the application
 */
export enum AnnotationType {
  HIGHLIGHT = 'highlight',
  NOTE = 'note',
  FREETEXT = 'freetext',
  REDACTION = 'redaction',
  TEXT_EDIT = 'textEdit',
}

/**
 * Represents a PDF document in the system
 */
export interface PDFDocument {
  id: string;
  name: string;
  createdAt: Date;
  currentVersionId: string | null;
}

/**
 * Represents a version/snapshot of a document
 * Versions are immutable - never modify after creation
 */
export interface Version {
  id: string;
  documentId: string;
  versionNumber: number;
  message: string;
  pdfData: ArrayBuffer; // Stored in IndexedDB, never in React state
  annotations: string; // JSON stringified annotation data
  textContent: string; // Extracted text for diffing
  createdAt: Date;
}

/**
 * Represents an annotation on a PDF page
 */
export interface Annotation {
  id: string;
  type: AnnotationType;
  pageIndex: number;
  rect: AnnotationRect;
  contents?: string;
  color?: string;
  opacity?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rectangle coordinates for annotation positioning
 */
export interface AnnotationRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Represents a change between two versions of annotations
 */
export interface AnnotationChange {
  type: 'added' | 'removed' | 'modified';
  annotation: Annotation;
  previousAnnotation?: Annotation; // Only for 'modified' type
  pageIndex: number;
  description: string;
}

/**
 * Result of comparing two versions
 */
export interface DiffResult {
  versionAId: string;
  versionBId: string;
  textDiffs: TextDiff[];
  annotationChanges: AnnotationChange[];
  summary: DiffSummary;
}

/**
 * Text diff between two versions (per-page)
 */
export interface TextDiff {
  pageIndex: number;
  changes: Array<[number, string]>; // diff-match-patch format: [operation, text]
  hasChanges: boolean;
  addedCount: number;
  removedCount: number;
}

/**
 * Summary statistics for a diff
 */
export interface DiffSummary {
  totalChanges: number;
  textChanges: number;
  annotationsAdded: number;
  annotationsRemoved: number;
  annotationsModified: number;
}

/**
 * Result of comparing annotations between two versions
 */
export interface AnnotationDiffResult {
  added: AnnotationDiffEntry[];
  deleted: AnnotationDiffEntry[];
  modified: { old: AnnotationDiffEntry; new: AnnotationDiffEntry }[];
}

/**
 * Simplified annotation entry for diff comparison
 */
export interface AnnotationDiffEntry {
  id: string;
  type: string;
  pageIndex: number;
  contents?: string;
  color?: string;
  boundingBox?: { left: number; top: number; width: number; height: number };
}

/**
 * Extracted text content from a PDF page
 */
export interface PageText {
  pageIndex: number;
  text: string;
}

/**
 * Loading state for async operations
 */
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Document store state interface
 */
export interface DocumentState extends LoadingState {
  currentDocument: PDFDocument | null;
  documents: PDFDocument[];
  setCurrentDocument: (doc: PDFDocument | null) => void;
  addDocument: (doc: PDFDocument) => void;
  removeDocument: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Version store state interface
 */
export interface VersionState extends LoadingState {
  versions: Version[];
  currentVersionId: string | null;
  compareVersionId: string | null;
  diffResult: DiffResult | null;
  isComparing: boolean;
  setVersions: (versions: Version[]) => void;
  addVersion: (version: Version) => void;
  setCurrentVersion: (id: string | null) => void;
  setCompareVersion: (id: string | null) => void;
  setDiffResult: (result: DiffResult | null) => void;
  setIsComparing: (comparing: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * PSPDFKit instance type (simplified)
 */
export interface PSPDFKitInstance {
  totalPageCount: number;
  viewState: {
    currentPageIndex: number;
  };
  addEventListener: (event: string, callback: (data: unknown) => void) => void;
  removeEventListener: (event: string, callback: (data: unknown) => void) => void;
  exportPDF: () => Promise<ArrayBuffer>;
  dispose: () => void;
}

/**
 * Tracked annotation from PSPDFKit, normalized for our use
 */
export interface TrackedAnnotation {
  id: string;
  type: AnnotationType;
  pageIndex: number;
  contents: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  pspdfkitId: string;
}

/**
 * Record of a single annotation change (create/update/delete)
 */
export interface AnnotationChangeRecord {
  id: string;
  annotationId: string;
  action: 'create' | 'update' | 'delete';
  type: AnnotationType;
  pageIndex: number;
  contents: string;
  timestamp: Date;
}

/**
 * Annotation store state interface
 */
export interface AnnotationState {
  annotations: TrackedAnnotation[];
  pendingChanges: AnnotationChangeRecord[];
  addAnnotation: (annotation: TrackedAnnotation) => void;
  updateAnnotation: (id: string, updates: Partial<TrackedAnnotation>) => void;
  removeAnnotation: (id: string) => void;
  setAnnotations: (annotations: TrackedAnnotation[]) => void;
  addChange: (change: AnnotationChangeRecord) => void;
  clearChanges: () => void;
  reset: () => void;
}

/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'pdf-flattened' | 'annotated-changelog';

/**
 * Export options configuration
 */
export interface ExportOptions {
  format: ExportFormat;
  includeAnnotations: boolean;
  includeChangelog: boolean;
  versionRange?: {
    from: string;
    to: string;
  };
}
