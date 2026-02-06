'use client';

/**
 * CommitDialog Component
 *
 * Modal dialog for creating a new version (commit).
 * - Auto-generates version number from current max + 1
 * - Required message textarea for commit description
 * - Shows summary of pending annotation changes
 * - Exports PDF data + annotation tracking data + extracted text
 * - Saves version to IndexedDB, clears unsaved changes, shows toast
 */

import { useState, useCallback } from 'react';
import { Loader2, GitCommitHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { versionOps, generateId } from '@/lib/db';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useVersionStore } from '@/store/useVersionStore';
import { useAnnotationStore } from '@/store/useAnnotationStore';
import type { Version, PageText } from '@/types';
import type { PSPDFKitInstanceType } from '@/components/pdf/PDFViewer';

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: PSPDFKitInstanceType | null;
}

export function CommitDialog({ open, onOpenChange, instance }: CommitDialogProps) {
  const [message, setMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  const { currentDocument } = useDocumentStore();
  const { versions, addVersion } = useVersionStore();
  const { pendingChanges, clearChanges } = useAnnotationStore();

  const nextVersionNumber = versions.length > 0
    ? Math.max(...versions.map((v) => v.versionNumber)) + 1
    : 1;

  const changeSummary = {
    created: pendingChanges.filter((c) => c.action === 'create').length,
    updated: pendingChanges.filter((c) => c.action === 'update').length,
    deleted: pendingChanges.filter((c) => c.action === 'delete').length,
  };
  const totalChanges = changeSummary.created + changeSummary.updated + changeSummary.deleted;

  /**
   * Extract text from every page using PSPDFKit textLinesForPageIndex
   */
  const extractText = useCallback(async (inst: PSPDFKitInstanceType): Promise<PageText[]> => {
    const pages: PageText[] = [];
    for (let i = 0; i < inst.totalPageCount; i++) {
      try {
        const textLines = await inst.textLinesForPageIndex(i);
        const text = textLines.map((line) => line.contents).join('\n');
        pages.push({ pageIndex: i, text });
      } catch {
        pages.push({ pageIndex: i, text: '' });
      }
    }
    return pages;
  }, []);

  /**
   * Commit: export PDF + annotations + text, save to IndexedDB
   */
  const handleCommit = useCallback(async () => {
    if (!instance || !currentDocument || !message.trim()) return;

    setIsCommitting(true);
    try {
      // Export current PDF state (with annotations baked in)
      const pdfData = await instance.exportPDF();

      // Serialize annotation tracking data from Zustand store
      const { annotations: currentAnnotations } = useAnnotationStore.getState();
      const annotationsJson = JSON.stringify(
        currentAnnotations.map((a) => ({
          id: a.pspdfkitId,
          type: a.type,
          pageIndex: a.pageIndex,
          contents: a.contents,
          color: a.color,
        }))
      );

      // Extract text content from every page
      const pageTexts = await extractText(instance);
      const textContent = JSON.stringify(pageTexts);

      // Build version record
      const versionId = generateId();
      const version: Version = {
        id: versionId,
        documentId: currentDocument.id,
        versionNumber: nextVersionNumber,
        message: message.trim(),
        pdfData,
        annotations: annotationsJson,
        textContent,
        createdAt: new Date(),
      };

      // Save full version (with pdfData) to IndexedDB
      await versionOps.create({
        id: version.id,
        documentId: version.documentId,
        versionNumber: version.versionNumber,
        message: version.message,
        pdfData: version.pdfData,
        annotations: version.annotations,
        textContent: version.textContent,
        createdAt: version.createdAt,
      });

      // Store only metadata (no pdfData) in Zustand
      addVersion({
        id: version.id,
        documentId: version.documentId,
        versionNumber: version.versionNumber,
        message: version.message,
        annotations: version.annotations,
        textContent: version.textContent,
        createdAt: version.createdAt,
      });

      // Clear pending changes
      clearChanges();

      toast.success(`Version ${nextVersionNumber} committed`);
      setMessage('');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to commit version:', err);
      toast.error('Failed to create version');
    } finally {
      setIsCommitting(false);
    }
  }, [instance, currentDocument, message, nextVersionNumber, extractText, addVersion, clearChanges, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommitHorizontal className="h-5 w-5" />
            Create Version
            <Badge variant="secondary" className="font-mono text-xs">
              V{nextVersionNumber}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Save the current document state as a new version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Commit message */}
          <div className="space-y-2">
            <label htmlFor="commit-message" className="text-sm font-medium">
              Commit message <span className="text-destructive">*</span>
            </label>
            <textarea
              id="commit-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe what changed in this version..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-none"
              disabled={isCommitting}
              autoFocus
            />
          </div>

          {/* Change summary */}
          {totalChanges > 0 && (
            <div className="rounded-md border bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Changes since last version</p>
              <div className="flex gap-3 text-xs">
                {changeSummary.created > 0 && (
                  <span className="text-green-600">
                    +{changeSummary.created} added
                  </span>
                )}
                {changeSummary.updated > 0 && (
                  <span className="text-blue-600">
                    ~{changeSummary.updated} modified
                  </span>
                )}
                {changeSummary.deleted > 0 && (
                  <span className="text-red-600">
                    -{changeSummary.deleted} removed
                  </span>
                )}
              </div>
            </div>
          )}

          {totalChanges === 0 && (
            <div className="rounded-md border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                No annotation changes since last version. You can still commit to capture the current PDF state.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCommitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCommit}
            disabled={!message.trim() || isCommitting}
          >
            {isCommitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Committing...
              </>
            ) : (
              <>
                <GitCommitHorizontal className="h-4 w-4 mr-1.5" />
                Commit V{nextVersionNumber}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
