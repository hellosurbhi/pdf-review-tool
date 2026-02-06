'use client';

/**
 * PageThumbnails Component
 *
 * Displays clickable page thumbnails in the left sidebar.
 * - Shows page numbers with visual selection state
 * - Allows navigation to specific pages
 * - Updates when current page changes in the viewer
 */

import { FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface PageThumbnailsProps {
  totalPages: number;
  currentPage: number;
  onPageSelect: (pageIndex: number) => void;
}

export function PageThumbnails({
  totalPages,
  currentPage,
  onPageSelect,
}: PageThumbnailsProps) {
  if (totalPages === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground text-center">
          No pages to display
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-3 space-y-2">
        {Array.from({ length: totalPages }, (_, index) => (
          <button
            key={index}
            onClick={() => onPageSelect(index)}
            className={cn(
              'w-full aspect-[3/4] rounded-lg border-2 transition-all',
              'flex flex-col items-center justify-center gap-1',
              'hover:border-primary/50 hover:bg-muted/50',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              currentPage === index
                ? 'border-primary bg-primary/5'
                : 'border-muted bg-card'
            )}
          >
            <FileText
              className={cn(
                'h-8 w-8',
                currentPage === index
                  ? 'text-primary'
                  : 'text-muted-foreground/50'
              )}
            />
            <span
              className={cn(
                'text-sm font-medium',
                currentPage === index
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {index + 1}
            </span>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
