'use client';

/**
 * AnnotationList Component
 *
 * Displays a list of annotations in the right sidebar.
 * - Shows type icon, page number, preview text, timestamp
 * - Click navigates viewer to the annotation's page
 * - Delete button with confirmation
 * - Styled for dark sidebar theme
 */

import { useState, useCallback } from 'react';
import {
  Highlighter,
  StickyNote,
  Type,
  Square,
  Pencil,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAnnotationStore } from '@/store/useAnnotationStore';
import { AnnotationType } from '@/types';
import type { TrackedAnnotation } from '@/types';
import type { PSPDFKitInstanceType } from './PDFViewer';
import { goToPage } from './PDFViewer';

interface AnnotationListProps {
  instance: PSPDFKitInstanceType | null;
}

/**
 * Icon for each annotation type
 */
function AnnotationIcon({ type, className }: { type: AnnotationType; className?: string }) {
  const iconProps = { className: cn('h-3.5 w-3.5', className) };

  switch (type) {
    case AnnotationType.HIGHLIGHT:
      return <Highlighter {...iconProps} />;
    case AnnotationType.NOTE:
      return <StickyNote {...iconProps} />;
    case AnnotationType.FREETEXT:
      return <Type {...iconProps} />;
    case AnnotationType.REDACTION:
      return <Square {...iconProps} />;
    case AnnotationType.TEXT_EDIT:
      return <Pencil {...iconProps} />;
    default:
      return <MessageSquare {...iconProps} />;
  }
}

/**
 * Human-readable label for annotation type
 */
function typeLabel(type: AnnotationType): string {
  const labels: Record<AnnotationType, string> = {
    [AnnotationType.HIGHLIGHT]: 'Highlight',
    [AnnotationType.NOTE]: 'Note',
    [AnnotationType.FREETEXT]: 'Text',
    [AnnotationType.REDACTION]: 'Redaction',
    [AnnotationType.TEXT_EDIT]: 'Edit',
  };
  return labels[type] ?? 'Annotation';
}

/**
 * Color for each annotation type used in the icon badge
 */
function typeColor(type: AnnotationType): string {
  const colors: Record<AnnotationType, string> = {
    [AnnotationType.HIGHLIGHT]: 'text-yellow-400',
    [AnnotationType.NOTE]: 'text-amber-400',
    [AnnotationType.FREETEXT]: 'text-blue-400',
    [AnnotationType.REDACTION]: 'text-red-400',
    [AnnotationType.TEXT_EDIT]: 'text-green-400',
  };
  return colors[type] ?? 'text-slate-400';
}

export function AnnotationList({ instance }: AnnotationListProps) {
  const { annotations, removeAnnotation, addChange } = useAnnotationStore();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /**
   * Navigate viewer to the annotation's page
   */
  const handleNavigate = useCallback(
    (annotation: TrackedAnnotation) => {
      if (instance) {
        goToPage(instance, annotation.pageIndex);
      }
    },
    [instance]
  );

  /**
   * Delete annotation from PSPDFKit and our store
   */
  const handleDelete = useCallback(
    async (annotation: TrackedAnnotation) => {
      // Delete from PSPDFKit instance
      if (instance) {
        try {
          const pageAnnotations = await instance.getAnnotations(annotation.pageIndex);
          let found = false;
          pageAnnotations.forEach((pspdfkitAnn) => {
            if (pspdfkitAnn.id === annotation.pspdfkitId && !found) {
              found = true;
              instance.delete(pspdfkitAnn).catch(() => {
                // PSPDFKit delete may fail silently
              });
            }
          });
        } catch {
          // Continue even if PSPDFKit delete fails
        }
      }

      // Remove from our store
      removeAnnotation(annotation.id);

      // Record the change
      addChange({
        id: `${Date.now()}-del`,
        annotationId: annotation.id,
        action: 'delete',
        type: annotation.type,
        pageIndex: annotation.pageIndex,
        contents: annotation.contents,
        timestamp: new Date(),
      });

      setConfirmDeleteId(null);
      toast.success('Annotation deleted');
    },
    [instance, removeAnnotation, addChange]
  );

  // Sort annotations by page index, then by creation date
  const sorted = [...annotations].sort((a, b) =>
    a.pageIndex !== b.pageIndex
      ? a.pageIndex - b.pageIndex
      : a.createdAt.getTime() - b.createdAt.getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <MessageSquare className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No annotations yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Use the toolbar to add annotations
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {sorted.map((annotation) => (
          <div
            key={annotation.id}
            className={cn(
              'group p-2.5 rounded-lg border border-white/10',
              'hover:bg-white/5 cursor-pointer transition-colors'
            )}
            onClick={() => handleNavigate(annotation)}
          >
            <div className="flex items-start gap-2">
              {/* Type icon with color */}
              <div className="mt-0.5 shrink-0">
                <AnnotationIcon
                  type={annotation.type}
                  className={typeColor(annotation.type)}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-medium text-slate-300">
                    {typeLabel(annotation.type)}
                  </span>
                  <span className="text-xs text-slate-500">
                    p.{annotation.pageIndex + 1}
                  </span>
                </div>
                {annotation.contents ? (
                  <p className="text-xs text-slate-400 truncate">
                    {annotation.contents}
                  </p>
                ) : (
                  <p className="text-xs text-slate-600 italic">
                    No text
                  </p>
                )}
              </div>

              {/* Delete button */}
              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {confirmDeleteId === annotation.id ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(annotation);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(annotation.id);
                          // Auto-reset after 3s if not confirmed
                          setTimeout(() => setConfirmDeleteId(null), 3000);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Click again to confirm</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
