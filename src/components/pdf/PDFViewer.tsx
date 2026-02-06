'use client';

/**
 * PDFViewer Component
 *
 * Renders PDF using PSPDFKit SDK.
 * - Loads dynamically to avoid SSR issues with WebAssembly
 * - Manages PSPDFKit instance lifecycle
 * - Provides callbacks for page changes and annotations
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
}

interface ViewState {
  currentPageIndex: number;
  set: (key: string, value: number) => ViewState;
}

interface PSPDFKitModule {
  load: (config: PSPDFKitConfig) => Promise<PSPDFKitInstanceType>;
  unload: (container: HTMLElement) => Promise<void>;
}

interface PSPDFKitConfig {
  container: HTMLElement | string;
  document: ArrayBuffer;
  baseUrl: string;
  licenseKey?: string;
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
   * Load PSPDFKit and render PDF
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

        // Dynamically import PSPDFKit (default export)
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

        // Load new instance
        const instance = await PSPDFKit.load({
          container,
          document: pdfData,
          baseUrl: `${window.location.origin}/pspdfkit-lib/`,
          licenseKey: process.env.NEXT_PUBLIC_PSPDFKIT_LICENSE_KEY,
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
        <div className="text-center">
          <p className="text-destructive mb-2">Failed to load PDF</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Loading PDF...</span>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '500px' }}
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
