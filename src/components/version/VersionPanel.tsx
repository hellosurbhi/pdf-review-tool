'use client';

/**
 * VersionPanel Component
 *
 * Displays version history in reverse chronological order.
 * - Version badge (V1, V2, ...) with accent border for current
 * - Commit message, relative timestamp, change count badge
 * - Click to switch versions, with unsaved changes warning dialog
 */

import { useState, useCallback } from 'react';
import { Clock, GitCommitHorizontal, AlertTriangle, History } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVersionStore } from '@/store/useVersionStore';
import { useAnnotationStore } from '@/store/useAnnotationStore';
import type { VersionMetadata } from '@/types';

interface VersionPanelProps {
  onCommitClick: () => void;
}

/**
 * Format a date into a relative timestamp string
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(date).toLocaleDateString();
}

/**
 * Parse annotation changes count from version annotations JSON
 */
function getAnnotationCount(annotations: string): number {
  try {
    const parsed = JSON.parse(annotations);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.annotations)) {
      return parsed.annotations.length;
    }
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
  } catch {
    // Ignore parse errors
  }
  return 0;
}

export function VersionPanel({ onCommitClick }: VersionPanelProps) {
  const { versions, currentVersionId, setCurrentVersion } = useVersionStore();
  const { pendingChanges, clearChanges } = useAnnotationStore();

  const [switchTarget, setSwitchTarget] = useState<VersionMetadata | null>(null);

  const hasUnsavedChanges = pendingChanges.length > 0;

  /**
   * Handle version click — show warning if unsaved changes exist
   */
  const handleVersionClick = useCallback((version: VersionMetadata) => {
    if (version.id === currentVersionId) return;

    if (hasUnsavedChanges) {
      setSwitchTarget(version);
    } else {
      setCurrentVersion(version.id);
      toast.info(`Switched to Version ${version.versionNumber}`);
    }
  }, [currentVersionId, hasUnsavedChanges, setCurrentVersion]);

  /**
   * Discard unsaved changes and switch to the target version
   */
  const handleDiscardAndSwitch = useCallback(() => {
    if (!switchTarget) return;
    clearChanges();
    setCurrentVersion(switchTarget.id);
    toast.info(`Switched to Version ${switchTarget.versionNumber}`);
    setSwitchTarget(null);
  }, [switchTarget, clearChanges, setCurrentVersion]);

  return (
    <>
      <div className="flex flex-col h-full">
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                  <History className="h-5 w-5 text-slate-500" />
                </div>
                <p className="text-sm text-slate-400 font-medium mb-1">No versions yet</p>
                <p className="text-xs text-slate-500 text-center">
                  Click &quot;Create Version&quot; below to save the current state as V1
                </p>
              </div>
            ) : (
              versions.map((version) => {
                const isCurrent = version.id === currentVersionId;
                const annotationCount = getAnnotationCount(version.annotations);

                return (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => handleVersionClick(version)}
                    className={`
                      w-full text-left p-3 rounded-lg border transition-colors
                      ${isCurrent
                        ? 'border-blue-500/50 bg-blue-500/10 border-l-blue-500 border-l-2'
                        : 'border-white/10 hover:bg-white/5 cursor-pointer'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge
                        variant="secondary"
                        className={`
                          text-xs font-mono px-1.5 py-0
                          ${isCurrent
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-white/10 text-slate-300'
                          }
                        `}
                      >
                        V{version.versionNumber}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        {annotationCount > 0 && (
                          <span className="text-[10px] bg-white/10 text-slate-400 px-1.5 rounded-full">
                            {annotationCount} ann.
                          </span>
                        )}
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(version.createdAt)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 truncate">
                      {version.message}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-white/10">
          <Button
            className="w-full"
            variant="outline"
            size="sm"
            onClick={onCommitClick}
          >
            <GitCommitHorizontal className="h-4 w-4 mr-1.5" />
            Create Version
          </Button>
        </div>
      </div>

      {/* Unsaved changes warning dialog */}
      <Dialog open={!!switchTarget} onOpenChange={(open) => !open && setSwitchTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unsaved Changes
            </DialogTitle>
            <DialogDescription>
              You have {pendingChanges.length} unsaved{' '}
              {pendingChanges.length === 1 ? 'change' : 'changes'}.
              Switching versions will discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwitchTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDiscardAndSwitch}>
              Discard & Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
