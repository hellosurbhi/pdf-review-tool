'use client';

/**
 * PDFViewer Component
 *
 * Renders PDF using PSPDFKit SDK with full toolbar and annotation support.
 * - Loads dynamically to avoid SSR issues with WebAssembly
 * - Configures toolbar: zoom, page nav, search, annotation tools
 * - Listens to annotation create/update/delete events
 * - Manages PSPDFKit instance lifecycle with proper cleanup
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { versionOps } from '@/lib/db';
import { useAnnotationStore } from '@/store/useAnnotationStore';
import { generateId } from '@/lib/db';
import { AnnotationType } from '@/types';
import type { TrackedAnnotation, AnnotationChangeRecord } from '@/types';

interface PDFViewerProps {
  versionId: string;
  onPageChange?: (pageIndex: number) => void;
  onTotalPagesChange?: (totalPages: number) => void;
  onInstanceReady?: (instance: PSPDFKitInstanceType) => void;
}

// PSPDFKit types (simplified for our use case)
export interface PSPDFKitInstanceType {
  totalPageCount: number;
  viewState: {
    currentPageIndex: number;
  };
  setViewState: (viewState: (current: ViewState) => ViewState) => void;
  addEventListener: (event: string, callback: (...args: unknown[]) => void) => void;
  removeEventListener: (event: string, callback: (...args: unknown[]) => void) => void;
  exportPDF: () => Promise<ArrayBuffer>;
  exportInstantJSON: () => Promise<{ format: string; annotations: unknown[] }>;
  getAnnotations: (pageIndex: number) => Promise<PSPDFKitAnnotationList>;
  textLinesForPageIndex: (pageIndex: number) => Promise<PSPDFKitTextLine[]>;
  delete: (annotationOrId: unknown) => Promise<void>;
  dispose: () => void;
  contentDocument: Document;
  setToolbarItems: (items: ToolbarItem[]) => void;
}

interface PSPDFKitAnnotationList {
  size: number;
  toArray: () => PSPDFKitAnnotation[];
  forEach: (callback: (annotation: PSPDFKitAnnotation) => void) => void;
}

export interface PSPDFKitAnnotation {
  id: string;
  pageIndex: number;
  boundingBox: { left: number; top: number; width: number; height: number };
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PSPDFKitTextLine {
  contents: string;
  pageIndex: number;
  boundingBox: { left: number; top: number; width: number; height: number };
}

interface ViewState {
  currentPageIndex: number;
  set: (key: string, value: number | string) => ViewState;
}

interface ToolbarItem {
  type: string;
  [key: string]: unknown;
}

interface PSPDFKitModule {
  load: (config: Record<string, unknown>) => Promise<PSPDFKitInstanceType>;
  unload: (container: HTMLElement) => Promise<void>;
}

/**
 * Map PSPDFKit annotation type name to our AnnotationType enum
 */
function mapAnnotationType(pspdfkitType: string): AnnotationType {
  const typeMap: Record<string, AnnotationType> = {
    'pspdfkit/highlight': AnnotationType.HIGHLIGHT,
    'pspdfkit/text-highlight': AnnotationType.HIGHLIGHT,
    'pspdfkit/note': AnnotationType.NOTE,
    'pspdfkit/text': AnnotationType.FREETEXT,
    'pspdfkit/ink': AnnotationType.FREETEXT,
    'pspdfkit/redaction': AnnotationType.REDACTION,
    'pspdfkit/markup/highlight': AnnotationType.HIGHLIGHT,
    'pspdfkit/comment': AnnotationType.NOTE,
    'pspdfkit/widget': AnnotationType.FREETEXT,
  };
  return typeMap[pspdfkitType] ?? AnnotationType.FREETEXT;
}

/**
 * Extract annotation contents/preview text
 */
function getAnnotationContents(annotation: PSPDFKitAnnotation): string {
  if (typeof annotation.text === 'string' && annotation.text) {
    return annotation.text;
  }
  if (typeof annotation.contents === 'string' && annotation.contents) {
    return annotation.contents;
  }
  if (typeof annotation.note === 'string' && annotation.note) {
    return annotation.note;
  }
  return '';
}

/**
 * Get annotation color as hex string
 */
function getAnnotationColor(annotation: PSPDFKitAnnotation): string {
  const color = annotation.color as { r?: number; g?: number; b?: number } | undefined;
  if (
    color &&
    typeof color.r === 'number' &&
    typeof color.g === 'number' &&
    typeof color.b === 'number'
  ) {
    const r = Math.round(color.r).toString(16).padStart(2, '0');
    const g = Math.round(color.g).toString(16).padStart(2, '0');
    const b = Math.round(color.b).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return '#ffeb3b';
}

export function PDFViewer({
  versionId,
  onPageChange,
  onTotalPagesChange,
  onInstanceReady,
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<PSPDFKitInstanceType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { addAnnotation, updateAnnotation, removeAnnotation, setAnnotations, addChange } =
    useAnnotationStore();

  /**
   * Handle page change events from PSPDFKit
   */
  const handlePageChange = useCallback(() => {
    if (instanceRef.current && onPageChange) {
      onPageChange(instanceRef.current.viewState.currentPageIndex);
    }
  }, [onPageChange]);

  /**
   * Convert a PSPDFKit annotation to our TrackedAnnotation type
   */
  const toTrackedAnnotation = useCallback(
    (annotation: PSPDFKitAnnotation): TrackedAnnotation => ({
      id: generateId(),
      type: mapAnnotationType(String(annotation.type ?? '')),
      pageIndex: annotation.pageIndex,
      contents: getAnnotationContents(annotation),
      color: getAnnotationColor(annotation),
      createdAt: new Date(),
      updatedAt: new Date(),
      pspdfkitId: annotation.id,
    }),
    []
  );

  /**
   * Handle annotation create event from PSPDFKit
   */
  const handleAnnotationCreate = useCallback(
    (annotations: unknown) => {
      const list = annotations as PSPDFKitAnnotationList;
      list.forEach((annotation: PSPDFKitAnnotation) => {
        const tracked = toTrackedAnnotation(annotation);
        addAnnotation(tracked);

        const change: AnnotationChangeRecord = {
          id: generateId(),
          annotationId: tracked.id,
          action: 'create',
          type: tracked.type,
          pageIndex: tracked.pageIndex,
          contents: tracked.contents,
          timestamp: new Date(),
        };
        addChange(change);
      });
    },
    [toTrackedAnnotation, addAnnotation, addChange]
  );

  /**
   * Handle annotation update event from PSPDFKit
   */
  const handleAnnotationUpdate = useCallback(
    (annotations: unknown) => {
      const list = annotations as PSPDFKitAnnotationList;
      list.forEach((annotation: PSPDFKitAnnotation) => {
        const { annotations: currentAnnotations } = useAnnotationStore.getState();
        const existing = currentAnnotations.find(
          (a) => a.pspdfkitId === annotation.id
        );
        if (existing) {
          updateAnnotation(existing.id, {
            contents: getAnnotationContents(annotation),
            color: getAnnotationColor(annotation),
            pageIndex: annotation.pageIndex,
          });

          const change: AnnotationChangeRecord = {
            id: generateId(),
            annotationId: existing.id,
            action: 'update',
            type: existing.type,
            pageIndex: annotation.pageIndex,
            contents: getAnnotationContents(annotation),
            timestamp: new Date(),
          };
          addChange(change);
        }
      });
    },
    [updateAnnotation, addChange]
  );

  /**
   * Handle annotation delete event from PSPDFKit
   */
  const handleAnnotationDelete = useCallback(
    (annotations: unknown) => {
      const list = annotations as PSPDFKitAnnotationList;
      list.forEach((annotation: PSPDFKitAnnotation) => {
        const { annotations: currentAnnotations } = useAnnotationStore.getState();
        const existing = currentAnnotations.find(
          (a) => a.pspdfkitId === annotation.id
        );
        if (existing) {
          removeAnnotation(existing.id);

          const change: AnnotationChangeRecord = {
            id: generateId(),
            annotationId: existing.id,
            action: 'delete',
            type: existing.type,
            pageIndex: existing.pageIndex,
            contents: existing.contents,
            timestamp: new Date(),
          };
          addChange(change);
        }
      });
    },
    [removeAnnotation, addChange]
  );

  /**
   * Load all existing annotations from PSPDFKit into our store
   */
  const syncAnnotationsFromInstance = useCallback(
    async (instance: PSPDFKitInstanceType) => {
      const allAnnotations: TrackedAnnotation[] = [];
      for (let i = 0; i < instance.totalPageCount; i++) {
        try {
          const pageAnnotations = await instance.getAnnotations(i);
          pageAnnotations.forEach((annotation: PSPDFKitAnnotation) => {
            allAnnotations.push(toTrackedAnnotation(annotation));
          });
        } catch {
          // Some pages might fail; continue
        }
      }
      setAnnotations(allAnnotations);
    },
    [toTrackedAnnotation, setAnnotations]
  );

  /**
   * Load PSPDFKit and render PDF with full configuration
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !versionId) return;

    let isMounted = true;

    const loadPDF = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get PDF data from IndexedDB
        const pdfData = await versionOps.getPdfData(versionId);
        if (!pdfData) {
          throw new Error('PDF data not found');
        }

        if (!isMounted) return;

        // Dynamically import PSPDFKit
        const pspdfkitModule = await import('pspdfkit');
        const PSPDFKit = pspdfkitModule.default as unknown as PSPDFKitModule;

        if (!isMounted) return;

        // Unload any existing instance
        if (instanceRef.current) {
          try {
            await PSPDFKit.unload(container);
          } catch {
            // Ignore unload errors
          }
          instanceRef.current = null;
        }

        // Load PSPDFKit with full configuration
        const instance = await PSPDFKit.load({
          container,
          document: pdfData,
          baseUrl: `${window.location.origin}/pspdfkit-lib/`,
          licenseKey: process.env.NEXT_PUBLIC_PSPDFKIT_LICENSE_KEY,
          disableTextSelection: false,
          toolbarItems: [
            { type: 'sidebar-thumbnails' },
            { type: 'sidebar-bookmarks' },
            { type: 'pager' },
            { type: 'zoom-out' },
            { type: 'zoom-in' },
            { type: 'zoom-mode' },
            { type: 'spacer' },
            { type: 'search' },
            { type: 'spacer' },
            { type: 'annotate' },
            { type: 'ink' },
            { type: 'highlighter' },
            { type: 'text-highlighter' },
            { type: 'note' },
            { type: 'text' },
            { type: 'spacer' },
            { type: 'print' },
          ],
        });

        if (!isMounted) {
          instance.dispose();
          return;
        }

        instanceRef.current = instance;

        // Notify parent of total pages
        if (onTotalPagesChange) {
          onTotalPagesChange(instance.totalPageCount);
        }

        // Add event listeners
        instance.addEventListener('viewState.currentPageIndex.change', handlePageChange);
        instance.addEventListener('annotations.create', handleAnnotationCreate);
        instance.addEventListener('annotations.update', handleAnnotationUpdate);
        instance.addEventListener('annotations.delete', handleAnnotationDelete);

        // Sync existing annotations
        await syncAnnotationsFromInstance(instance);

        // Notify parent that instance is ready
        if (onInstanceReady) {
          onInstanceReady(instance);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load PDF:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
          setIsLoading(false);
        }
      }
    };

    loadPDF();

    // Cleanup on unmount or when versionId changes
    return () => {
      isMounted = false;
      const instance = instanceRef.current;
      if (instance) {
        instance.removeEventListener('viewState.currentPageIndex.change', handlePageChange);
        instance.removeEventListener('annotations.create', handleAnnotationCreate);
        instance.removeEventListener('annotations.update', handleAnnotationUpdate);
        instance.removeEventListener('annotations.delete', handleAnnotationDelete);
        instance.dispose();
        instanceRef.current = null;
      }
    };
  }, [
    versionId,
    handlePageChange,
    handleAnnotationCreate,
    handleAnnotationUpdate,
    handleAnnotationDelete,
    syncAnnotationsFromInstance,
    onTotalPagesChange,
    onInstanceReady,
  ]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="font-semibold mb-1">Failed to load PDF</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading PDF...</span>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full"
      />
    </div>
  );
}

/**
 * Utility function to navigate to a specific page
 */
export function goToPage(instance: PSPDFKitInstanceType, pageIndex: number) {
  if (instance && pageIndex >= 0 && pageIndex < instance.totalPageCount) {
    instance.setViewState((viewState) => viewState.set('currentPageIndex', pageIndex));
  }
}
