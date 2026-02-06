'use client';

/**
 * PDFViewer Component
 *
 * Renders PDF using PSPDFKit SDK with full toolbar configuration.
 * - Loads dynamically to avoid SSR issues with WebAssembly
 * - Configures toolbar: zoom, page nav, search, annotation tools
 * - Enables text selection, thumbnails sidebar, search with hit count
 * - Manages PSPDFKit instance lifecycle with proper cleanup
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { versionOps } from '@/lib/db';

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
  addEventListener: (event: string, callback: () => void) => void;
  removeEventListener: (event: string, callback: () => void) => void;
  exportPDF: () => Promise<ArrayBuffer>;
  getAnnotations: (pageIndex: number) => Promise<unknown>;
  dispose: () => void;
  contentDocument: Document;
  setToolbarItems: (items: ToolbarItem[]) => void;
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

  /**
   * Handle page change events from PSPDFKit
   */
  const handlePageChange = useCallback(() => {
    if (instanceRef.current && onPageChange) {
      onPageChange(instanceRef.current.viewState.currentPageIndex);
    }
  }, [onPageChange]);

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
          // Enable text selection
          disableTextSelection: false,
          // Enable built-in sidebar with thumbnails
          initialViewState: new (pspdfkitModule as unknown as {
            ViewState: new (config: Record<string, unknown>) => unknown;
          }).ViewState({
            sidebarMode: null, // Start without sidebar (we have custom thumbnails)
          }),
          // Toolbar configuration
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

        // Add page change listener
        instance.addEventListener('viewState.currentPageIndex.change', handlePageChange);

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
        instance.dispose();
        instanceRef.current = null;
      }
    };
  }, [versionId, handlePageChange, onTotalPagesChange, onInstanceReady]);

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
