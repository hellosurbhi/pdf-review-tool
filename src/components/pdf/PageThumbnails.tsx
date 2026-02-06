'use client';

/**
 * PageThumbnails Component
 *
 * Displays clickable page thumbnails in the left sidebar.
 * - Shows page numbers with visual selection state
 * - Current page highlighted with accent blue border
 * - Styled for dark sidebar theme
 */

import { useRef, useEffect } from 'react';
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
  const activeRef = useRef<HTMLButtonElement>(null);

  /**
   * Scroll active thumbnail into view when current page changes
   */
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentPage]);

  if (totalPages === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-slate-500 text-center">
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
            ref={index === currentPage ? activeRef : null}
            onClick={() => onPageSelect(index)}
            className={cn(
              'w-full aspect-[3/4] rounded-lg border-2 transition-all duration-150',
              'flex flex-col items-center justify-center gap-1',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0',
              currentPage === index
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
            )}
          >
            <FileText
              className={cn(
                'h-8 w-8',
                currentPage === index
                  ? 'text-blue-400'
                  : 'text-slate-500'
              )}
            />
            <span
              className={cn(
                'text-sm font-medium',
                currentPage === index
                  ? 'text-blue-300'
                  : 'text-slate-400'
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
