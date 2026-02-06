'use client';

/**
 * ExportButton Component
 *
 * Header button to export an annotated PDF with changelog and inline callouts.
 * - Shows loading spinner during PDF generation
 * - Disabled when only V1 exists (nothing to annotate)
 * - Downloads the generated file on completion
 * - Listens for Ctrl+E keyboard shortcut via custom event
 */

import { useState, useCallback, useEffect } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { exportAnnotatedPDFFromDB } from '@/lib/pdf-utils';

interface ExportButtonProps {
  documentId: string;
  documentName: string;
  currentVersionId: string;
  versionCount: number;
}

export function ExportButton({
  documentId,
  documentName,
  currentVersionId,
  versionCount,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const canExport = versionCount >= 2;

  const handleExport = useCallback(async () => {
    if (!canExport || isExporting) return;

    setIsExporting(true);
    try {
      await exportAnnotatedPDFFromDB(documentId, documentName, currentVersionId);
      toast.success('Annotated PDF exported');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  }, [canExport, isExporting, documentId, documentName, currentVersionId]);

  /** Listen for keyboard shortcut trigger from page.tsx */
  useEffect(() => {
    function onExportTrigger() {
      handleExport();
    }
    window.addEventListener('pdf-export-trigger', onExportTrigger);
    return () => window.removeEventListener('pdf-export-trigger', onExportTrigger);
  }, [handleExport]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleExport}
          disabled={!canExport || isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {canExport ? 'Export Annotated PDF (Ctrl+E)' : 'Need at least 2 versions to export'}
      </TooltipContent>
    </Tooltip>
  );
}
