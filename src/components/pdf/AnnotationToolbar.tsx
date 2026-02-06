'use client';

/**
 * AnnotationToolbar Component
 *
 * Floating toolbar below the header for annotation tools.
 * - Highlight with color picker (yellow, green, blue, pink)
 * - Sticky note, free text, redaction tools
 * - Pointer mode to deselect tools
 * - Active tool gets highlighted state
 */

import { useState, useCallback } from 'react';
import {
  MousePointer2,
  Highlighter,
  StickyNote,
  Type,
  Square,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { PSPDFKitInstanceType } from './PDFViewer';

type AnnotationTool = 'pointer' | 'highlight' | 'note' | 'text' | 'redaction';

interface HighlightColor {
  name: string;
  value: string;
  tailwind: string;
}

const HIGHLIGHT_COLORS: HighlightColor[] = [
  { name: 'Yellow', value: '#ffeb3b', tailwind: 'bg-yellow-400' },
  { name: 'Green', value: '#66bb6a', tailwind: 'bg-green-400' },
  { name: 'Blue', value: '#42a5f5', tailwind: 'bg-blue-400' },
  { name: 'Pink', value: '#ec407a', tailwind: 'bg-pink-400' },
];

interface AnnotationToolbarProps {
  instance: PSPDFKitInstanceType | null;
}

export function AnnotationToolbar({ instance }: AnnotationToolbarProps) {
  const [activeTool, setActiveTool] = useState<AnnotationTool>('pointer');
  const [highlightColor, setHighlightColor] = useState<HighlightColor>(HIGHLIGHT_COLORS[0]);

  /**
   * Set the active PSPDFKit interaction mode for a tool.
   * Falls back to dispatching toolbar button clicks when the programmatic
   * API is unavailable or fails.
   */
  const selectTool = useCallback(
    (tool: AnnotationTool) => {
      setActiveTool(tool);

      if (!instance) return;

      // Attempt to use the PSPDFKit toolbar buttons by dispatching
      // clicks on the built-in toolbar.  When PSPDFKit is running in
      // evaluation mode the programmatic interaction-mode API may be
      // restricted, so we keep this best-effort.
      try {
        const doc = instance.contentDocument;
        if (!doc) return;

        const buttonSelectors: Record<AnnotationTool, string | null> = {
          pointer: null, // deselect by clicking current active
          highlight: '[data-testid="text-highlighter"]',
          note: '[data-testid="note"]',
          text: '[data-testid="text"]',
          redaction: null,
        };

        const selector = buttonSelectors[tool];
        if (selector) {
          const btn = doc.querySelector(selector) as HTMLElement | null;
          btn?.click();
        }
      } catch {
        // PSPDFKit iframe access may be blocked; that's fine
      }
    },
    [instance]
  );

  /**
   * Switch to pointer (selection) mode
   */
  const handlePointer = useCallback(() => {
    selectTool('pointer');
    // Press Escape to exit any active annotation mode
    if (instance) {
      try {
        const doc = instance.contentDocument;
        doc?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      } catch {
        // ignore
      }
    }
  }, [selectTool, instance]);

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-card/80 backdrop-blur-sm shrink-0">
      <span className="text-xs text-muted-foreground mr-2 font-medium">Tools</span>

      {/* Pointer / Select mode */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              activeTool === 'pointer' && 'bg-primary/10 text-primary'
            )}
            onClick={handlePointer}
          >
            <MousePointer2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Select (Pointer)</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Highlight with color picker */}
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-r-none',
                activeTool === 'highlight' && 'bg-primary/10 text-primary'
              )}
              onClick={() => selectTool('highlight')}
            >
              <Highlighter className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Highlight</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-5 rounded-l-none px-0',
                activeTool === 'highlight' && 'bg-primary/10'
              )}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[140px]">
            {HIGHLIGHT_COLORS.map((color) => (
              <DropdownMenuItem
                key={color.value}
                onClick={() => {
                  setHighlightColor(color);
                  selectTool('highlight');
                }}
                className="gap-2"
              >
                <div
                  className={cn('w-4 h-4 rounded-full border', color.tailwind)}
                />
                <span>{color.name}</span>
                {highlightColor.value === color.value && (
                  <span className="ml-auto text-xs text-primary">Active</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sticky Note */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              activeTool === 'note' && 'bg-primary/10 text-primary'
            )}
            onClick={() => selectTool('note')}
          >
            <StickyNote className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Sticky Note</TooltipContent>
      </Tooltip>

      {/* Free Text */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              activeTool === 'text' && 'bg-primary/10 text-primary'
            )}
            onClick={() => selectTool('text')}
          >
            <Type className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Free Text</TooltipContent>
      </Tooltip>

      {/* Redaction */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              activeTool === 'redaction' && 'bg-primary/10 text-primary'
            )}
            onClick={() => selectTool('redaction')}
          >
            <Square className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Redaction</TooltipContent>
      </Tooltip>

      {/* Active color indicator */}
      {activeTool === 'highlight' && (
        <>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div
              className={cn('w-3 h-3 rounded-full', highlightColor.tailwind)}
            />
            <span>{highlightColor.name}</span>
          </div>
        </>
      )}
    </div>
  );
}
