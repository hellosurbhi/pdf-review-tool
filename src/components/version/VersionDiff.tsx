'use client';

/**
 * VersionDiff Component
 *
 * Full diff view with:
 * - Diff controls: base/compare version selectors, compare/exit buttons
 * - Per-page text diff panel with color-coded additions/deletions
 * - Annotation diff summary
 * - Diff summary panel with stats and page navigation
 * - Color legend with visibility toggles
 */

import { useState, useCallback, useMemo } from 'react';
import {
  GitCompareArrows,
  X,
  ChevronUp,
  ChevronDown,
  FileText,
  MessageSquare,
  Plus,
  Minus,
  Pencil,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVersionStore } from '@/store/useVersionStore';
import { computeFullDiff } from '@/lib/diff-utils';
import type { DiffResult, TextDiff, AnnotationChange } from '@/types';

interface VersionDiffProps {
  onExit: () => void;
}

/**
 * Render a single text diff segment with color coding
 */
function DiffSegment({ op, text }: { op: number; text: string }) {
  if (op === 0) {
    return <span className="text-muted-foreground">{text}</span>;
  }
  if (op === 1) {
    return (
      <span className="bg-green-500/20 text-green-700 dark:text-green-400 rounded-sm px-0.5">
        {text}
      </span>
    );
  }
  if (op === -1) {
    return (
      <span className="bg-red-500/20 text-red-700 dark:text-red-400 line-through rounded-sm px-0.5">
        {text}
      </span>
    );
  }
  return <span>{text}</span>;
}

/**
 * Render a per-page text diff
 */
function PageDiff({ diff, showAdditions, showDeletions }: {
  diff: TextDiff;
  showAdditions: boolean;
  showDeletions: boolean;
}) {
  const filteredChanges = diff.changes.filter(([op]) => {
    if (op === 1 && !showAdditions) return false;
    if (op === -1 && !showDeletions) return false;
    return true;
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <span className="text-sm font-medium">Page {diff.pageIndex + 1}</span>
        <div className="flex items-center gap-2 text-xs">
          {diff.addedCount > 0 && (
            <span className="text-green-600 flex items-center gap-0.5">
              <Plus className="h-3 w-3" />
              {diff.addedCount}
            </span>
          )}
          {diff.removedCount > 0 && (
            <span className="text-red-600 flex items-center gap-0.5">
              <Minus className="h-3 w-3" />
              {diff.removedCount}
            </span>
          )}
        </div>
      </div>
      <div className="p-3 text-sm leading-relaxed whitespace-pre-wrap font-mono text-xs max-h-64 overflow-auto">
        {filteredChanges.map(([op, text], i) => (
          <DiffSegment key={i} op={op} text={text} />
        ))}
      </div>
    </div>
  );
}

/**
 * Render a single annotation change entry
 */
function AnnotationChangeEntry({ change }: { change: AnnotationChange }) {
  const iconMap = {
    added: <Plus className="h-3.5 w-3.5 text-green-500" />,
    removed: <Minus className="h-3.5 w-3.5 text-red-500" />,
    modified: <Pencil className="h-3.5 w-3.5 text-amber-500" />,
  };

  const bgMap = {
    added: 'bg-green-500/10 border-green-500/20',
    removed: 'bg-red-500/10 border-red-500/20',
    modified: 'bg-amber-500/10 border-amber-500/20',
  };

  return (
    <div className={`flex items-start gap-2 p-2 rounded-md border text-sm ${bgMap[change.type]}`}>
      {iconMap[change.type]}
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate">{change.description}</p>
        <span className="text-[10px] text-muted-foreground">
          Page {change.pageIndex + 1}
        </span>
      </div>
    </div>
  );
}

export function VersionDiff({ onExit }: VersionDiffProps) {
  const { versions } = useVersionStore();

  const [baseVersionId, setBaseVersionId] = useState<string>('');
  const [compareVersionId, setCompareVersionId] = useState<string>('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);

  // Legend visibility toggles
  const [showAdditions, setShowAdditions] = useState(true);
  const [showDeletions, setShowDeletions] = useState(true);
  const [showModifications, setShowModifications] = useState(true);

  /**
   * Pages with text changes, for navigation
   */
  const changedPages = useMemo(() => {
    if (!diffResult) return [];
    return diffResult.textDiffs
      .filter((d) => d.hasChanges)
      .map((d) => d.pageIndex);
  }, [diffResult]);

  /**
   * Filtered text diffs (only pages with changes)
   */
  const filteredTextDiffs = useMemo(() => {
    if (!diffResult) return [];
    return diffResult.textDiffs.filter((d) => d.hasChanges);
  }, [diffResult]);

  /**
   * Filtered annotation changes based on legend toggles
   */
  const filteredAnnotationChanges = useMemo(() => {
    if (!diffResult) return [];
    return diffResult.annotationChanges.filter((c) => {
      if (c.type === 'added' && !showAdditions) return false;
      if (c.type === 'removed' && !showDeletions) return false;
      if (c.type === 'modified' && !showModifications) return false;
      return true;
    });
  }, [diffResult, showAdditions, showDeletions, showModifications]);

  /**
   * Run diff computation
   */
  const handleCompare = useCallback(async () => {
    if (!baseVersionId || !compareVersionId) {
      toast.error('Select both versions to compare');
      return;
    }
    if (baseVersionId === compareVersionId) {
      toast.error('Select two different versions');
      return;
    }

    setIsComputing(true);
    setDiffResult(null);
    setCurrentChangeIndex(0);

    try {
      const result = await computeFullDiff(baseVersionId, compareVersionId);
      setDiffResult(result);
      toast.success(`Diff computed: ${result.summary.totalChanges} changes found`);
    } catch (err) {
      console.error('Diff computation failed:', err);
      toast.error('Failed to compute diff');
    } finally {
      setIsComputing(false);
    }
  }, [baseVersionId, compareVersionId]);

  /**
   * Navigate to next changed page
   */
  const handleNextChange = useCallback(() => {
    if (changedPages.length === 0) return;
    setCurrentChangeIndex((prev) =>
      prev < changedPages.length - 1 ? prev + 1 : 0
    );
  }, [changedPages.length]);

  /**
   * Navigate to previous changed page
   */
  const handlePrevChange = useCallback(() => {
    if (changedPages.length === 0) return;
    setCurrentChangeIndex((prev) =>
      prev > 0 ? prev - 1 : changedPages.length - 1
    );
  }, [changedPages.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Diff Controls Bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-card shrink-0 flex-wrap">
        <GitCompareArrows className="h-4 w-4 text-muted-foreground shrink-0" />

        <Select value={baseVersionId} onValueChange={setBaseVersionId}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Base version" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={v.id} className="text-xs">
                V{v.versionNumber} — {v.message.slice(0, 25)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">vs</span>

        <Select value={compareVersionId} onValueChange={setCompareVersionId}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Compare with" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={v.id} className="text-xs">
                V{v.versionNumber} — {v.message.slice(0, 25)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="default"
          className="h-8 text-xs"
          onClick={handleCompare}
          disabled={isComputing || !baseVersionId || !compareVersionId}
        >
          {isComputing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              Computing...
            </>
          ) : (
            'Compare'
          )}
        </Button>

        <div className="flex-1" />

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={onExit}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Exit Diff
        </Button>
      </div>

      {/* Main diff content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Diff view area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!diffResult && !isComputing && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-xs">
                <GitCompareArrows className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Select two versions and click Compare to see differences.
                </p>
              </div>
            </div>
          )}

          {isComputing && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Computing diff...</span>
              </div>
            </div>
          )}

          {diffResult && !isComputing && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4 max-w-3xl mx-auto">
                {/* Text Diffs */}
                {filteredTextDiffs.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">
                        Text Changes ({filteredTextDiffs.length} {filteredTextDiffs.length === 1 ? 'page' : 'pages'})
                      </h3>
                    </div>
                    {filteredTextDiffs.map((diff) => (
                      <PageDiff
                        key={diff.pageIndex}
                        diff={diff}
                        showAdditions={showAdditions}
                        showDeletions={showDeletions}
                      />
                    ))}
                  </div>
                )}

                {/* Annotation Diffs */}
                {filteredAnnotationChanges.length > 0 && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">
                        Annotation Changes ({filteredAnnotationChanges.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {filteredAnnotationChanges.map((change, i) => (
                        <AnnotationChangeEntry key={i} change={change} />
                      ))}
                    </div>
                  </div>
                )}

                {/* No changes found */}
                {filteredTextDiffs.length === 0 && filteredAnnotationChanges.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">
                      No differences found between these versions.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right sidebar: Summary + Legend (only when diff result exists) */}
        {diffResult && (
          <aside className="w-64 border-l flex flex-col shrink-0 bg-muted/30">
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                {/* Summary Panel */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Summary
                  </h4>
                  <div className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total changes</span>
                      <Badge variant="secondary" className="font-mono">
                        {diffResult.summary.totalChanges}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Text changes</span>
                        <span>{diffResult.summary.textChanges} pages</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-green-600 flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Annotations added
                        </span>
                        <span>{diffResult.summary.annotationsAdded}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-red-600 flex items-center gap-1">
                          <Minus className="h-3 w-3" /> Annotations removed
                        </span>
                        <span>{diffResult.summary.annotationsRemoved}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-amber-600 flex items-center gap-1">
                          <Pencil className="h-3 w-3" /> Annotations modified
                        </span>
                        <span>{diffResult.summary.annotationsModified}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Page Navigation */}
                {changedPages.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Changed Pages
                    </h4>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handlePrevChange}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xs flex-1 text-center text-muted-foreground">
                        {currentChangeIndex + 1} / {changedPages.length}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleNextChange}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {changedPages.map((pageIdx, i) => (
                        <button
                          key={pageIdx}
                          type="button"
                          onClick={() => setCurrentChangeIndex(i)}
                          className={`
                            text-[10px] px-1.5 py-0.5 rounded border transition-colors
                            ${i === currentChangeIndex
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border hover:bg-muted'
                            }
                          `}
                        >
                          p.{pageIdx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Legend
                  </h4>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showAdditions}
                        onChange={(e) => setShowAdditions(e.target.checked)}
                        className="rounded border-green-400 text-green-500 focus:ring-green-500 h-3.5 w-3.5"
                      />
                      <span className="inline-block w-3 h-3 rounded-sm bg-green-500/30 border border-green-500/50" />
                      <span>Added</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDeletions}
                        onChange={(e) => setShowDeletions(e.target.checked)}
                        className="rounded border-red-400 text-red-500 focus:ring-red-500 h-3.5 w-3.5"
                      />
                      <span className="inline-block w-3 h-3 rounded-sm bg-red-500/30 border border-red-500/50" />
                      <span>Removed</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showModifications}
                        onChange={(e) => setShowModifications(e.target.checked)}
                        className="rounded border-amber-400 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5"
                      />
                      <span className="inline-block w-3 h-3 rounded-sm bg-amber-500/30 border border-amber-500/50" />
                      <span>Modified</span>
                    </label>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>
        )}
      </div>
    </div>
  );
}
