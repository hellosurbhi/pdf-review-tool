'use client';

/**
 * Main Application Page
 *
 * Layout structure:
 * - Header bar (56px): title, version badge, unsaved changes, commit/export/diff
 * - Annotation toolbar (when document loaded, not in diff mode)
 * - Left sidebar (240px): Page thumbnails, dark theme, collapsible
 * - Main content: PDF viewer, full-screen upload zone, or diff view
 * - Right sidebar (280px): Version history + annotation list, dark theme, collapsible
 *
 * UI polish:
 * - Fade transitions between upload and viewer
 * - Loading skeleton while PDF loads
 * - Empty states with icons and helpful messages
 * - Keyboard shortcuts: Ctrl+S (commit), Ctrl+E (export)
 * - Error boundary around PDFViewer
 * - Responsive layout (1024px+)
 * - Tooltips on all icon buttons
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FileText,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  GitCommitHorizontal,
  GitCompareArrows,
  Clock,
  MessageSquare,
  CircleDot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PDFUploader,
  PDFViewer,
  PageThumbnails,
  AnnotationToolbar,
  AnnotationList,
  PDFErrorBoundary,
  goToPage,
  type PSPDFKitInstanceType,
} from '@/components/pdf';
import { CommitDialog, VersionPanel, VersionDiff } from '@/components/version';
import { ExportButton } from '@/components/export';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useVersionStore } from '@/store/useVersionStore';
import { useUnsavedChangeCount, useAnnotations } from '@/store/useAnnotationStore';

export default function Home() {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [diffMode, setDiffMode] = useState(false);

  const pspdfkitInstanceRef = useRef<PSPDFKitInstanceType | null>(null);

  const { currentDocument } = useDocumentStore();
  const { versions, currentVersionId } = useVersionStore();
  const unsavedCount = useUnsavedChangeCount();
  const annotations = useAnnotations();

  const currentVersion = versions.find((v) => v.id === currentVersionId);

  /**
   * Handle page selection from thumbnails
   */
  const handlePageSelect = useCallback((pageIndex: number) => {
    if (pspdfkitInstanceRef.current) {
      goToPage(pspdfkitInstanceRef.current, pageIndex);
    }
    setCurrentPage(pageIndex);
  }, []);

  /**
   * Store PSPDFKit instance reference when ready
   */
  const handleInstanceReady = useCallback((instance: PSPDFKitInstanceType) => {
    pspdfkitInstanceRef.current = instance;
  }, []);

  const hasDocument = !!currentDocument;
  const canDiff = versions.length >= 2;

  /**
   * Keyboard shortcuts: Ctrl+S (commit), Ctrl+E (export)
   */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === 's' && hasDocument && !diffMode) {
          e.preventDefault();
          setCommitDialogOpen(true);
        }
        if (e.key === 'e' && hasDocument && !diffMode && versions.length >= 2 && currentVersionId) {
          e.preventDefault();
          // Trigger export by dispatching a custom event the ExportButton listens to
          window.dispatchEvent(new CustomEvent('pdf-export-trigger'));
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasDocument, diffMode, versions.length, currentVersionId]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background min-w-[768px]">
        {/* Header */}
        <header className="flex items-center justify-between h-14 px-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-semibold text-base">PDF Review Tool</span>
            </div>
            {currentDocument && (
              <>
                <Separator orientation="vertical" className="h-5" />
                <span className="text-sm text-muted-foreground truncate max-w-48">
                  {currentDocument.name}
                </span>
                {currentVersion && !diffMode && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    V{currentVersion.versionNumber}
                  </Badge>
                )}
                {diffMode && (
                  <Badge variant="secondary" className="font-mono text-xs bg-purple-500/15 text-purple-600 border-purple-500/25">
                    Diff Mode
                  </Badge>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {currentDocument && (
              <>
                {/* Unsaved changes badge */}
                {unsavedCount > 0 && !diffMode && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className="bg-amber-500/15 text-amber-600 border-amber-500/25 gap-1 cursor-default"
                      >
                        <CircleDot className="h-3 w-3" />
                        {unsavedCount} unsaved {unsavedCount === 1 ? 'change' : 'changes'}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Commit to save these changes as a new version
                    </TooltipContent>
                  </Tooltip>
                )}

                {!diffMode && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCommitDialogOpen(true)}
                        >
                          <GitCommitHorizontal className="h-4 w-4 mr-1.5" />
                          <span className="hidden sm:inline">Commit</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Create a new version (Ctrl+S)</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDiffMode(true)}
                          disabled={!canDiff}
                        >
                          <GitCompareArrows className="h-4 w-4 mr-1.5" />
                          <span className="hidden sm:inline">Diff</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {canDiff ? 'Compare versions' : 'Need at least 2 versions to compare'}
                      </TooltipContent>
                    </Tooltip>

                    {currentDocument && currentVersionId && (
                      <ExportButton
                        documentId={currentDocument.id}
                        documentName={currentDocument.name}
                        currentVersionId={currentVersionId}
                        versionCount={versions.length}
                      />
                    )}
                  </>
                )}

                <Separator orientation="vertical" className="h-5 mx-1" />
              </>
            )}

            {!currentDocument && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upload PDF</TooltipContent>
              </Tooltip>
            )}
          </div>
        </header>

        {/* Diff Mode: full-width diff view replaces normal layout */}
        {hasDocument && diffMode ? (
          <VersionDiff onExit={() => setDiffMode(false)} />
        ) : (
          <>
            {/* Annotation Toolbar (only when document loaded) */}
            {hasDocument && (
              <AnnotationToolbar instance={pspdfkitInstanceRef.current} />
            )}

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Sidebar - Page Thumbnails */}
              {hasDocument && (
                <>
                  <aside
                    className={`
                      ${leftSidebarOpen ? 'w-60' : 'w-0'}
                      flex-shrink-0 border-r
                      transition-all duration-200 overflow-hidden
                      sidebar-dark
                    `}
                  >
                    <div className="w-60 h-full flex flex-col">
                      <div className="flex items-center justify-between p-3 border-b border-white/10">
                        <span className="text-sm font-medium text-slate-200">Pages</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-slate-200 hover:bg-white/10"
                              onClick={() => setLeftSidebarOpen(false)}
                            >
                              <PanelLeftClose className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Close sidebar</TooltipContent>
                        </Tooltip>
                      </div>
                      {totalPages > 0 ? (
                        <PageThumbnails
                          totalPages={totalPages}
                          currentPage={currentPage}
                          onPageSelect={handlePageSelect}
                        />
                      ) : (
                        <div className="flex-1 flex items-center justify-center p-4">
                          <div className="text-center">
                            <div className="mx-auto w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center mb-2 animate-pulse">
                              <FileText className="h-4 w-4 text-slate-500" />
                            </div>
                            <p className="text-xs text-slate-500">
                              Loading pages...
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </aside>

                  {/* Toggle Left Sidebar Button (when closed) */}
                  {!leftSidebarOpen && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-20 z-10 h-8 w-8"
                          onClick={() => setLeftSidebarOpen(true)}
                        >
                          <PanelLeftOpen className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Show pages</TooltipContent>
                    </Tooltip>
                  )}
                </>
              )}

              {/* Main PDF Viewer / Upload Area */}
              <main className="flex-1 flex flex-col min-w-0 bg-muted/10">
                {!currentDocument ? (
                  <div className="animate-in fade-in duration-300">
                    <PDFUploader />
                  </div>
                ) : currentVersionId ? (
                  <div className="flex-1 flex flex-col animate-in fade-in duration-300">
                    <PDFErrorBoundary>
                      <PDFViewer
                        versionId={currentVersionId}
                        onPageChange={setCurrentPage}
                        onTotalPagesChange={setTotalPages}
                        onInstanceReady={handleInstanceReady}
                      />
                    </PDFErrorBoundary>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3 animate-pulse">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground text-sm">Loading document...</p>
                    </div>
                  </div>
                )}
              </main>

              {/* Right Sidebar - Version History + Annotations */}
              {hasDocument && (
                <>
                  {/* Toggle Right Sidebar Button (when closed) */}
                  {!rightSidebarOpen && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-20 z-10 h-8 w-8"
                          onClick={() => setRightSidebarOpen(true)}
                        >
                          <PanelRightOpen className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Show panel</TooltipContent>
                    </Tooltip>
                  )}

                  <aside
                    className={`
                      ${rightSidebarOpen ? 'w-70' : 'w-0'}
                      flex-shrink-0 border-l
                      transition-all duration-200 overflow-hidden
                      sidebar-dark
                    `}
                  >
                    <div className="w-70 h-full flex flex-col">
                      {/* Tabbed panels: Versions | Annotations */}
                      <Tabs defaultValue="versions" className="flex flex-col h-full">
                        <div className="flex items-center justify-between px-2 pt-2 border-b border-white/10">
                          <TabsList className="bg-white/5 h-8">
                            <TabsTrigger
                              value="versions"
                              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-slate-200 text-slate-400 gap-1.5 h-6 px-2.5"
                            >
                              <Clock className="h-3 w-3" />
                              Versions
                            </TabsTrigger>
                            <TabsTrigger
                              value="annotations"
                              className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-slate-200 text-slate-400 gap-1.5 h-6 px-2.5"
                            >
                              <MessageSquare className="h-3 w-3" />
                              Annotations
                              {annotations.length > 0 && (
                                <span className="ml-0.5 text-[10px] bg-white/10 px-1.5 rounded-full">
                                  {annotations.length}
                                </span>
                              )}
                            </TabsTrigger>
                          </TabsList>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-slate-200 hover:bg-white/10"
                                onClick={() => setRightSidebarOpen(false)}
                              >
                                <PanelRightClose className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Close panel</TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Version History Tab */}
                        <TabsContent value="versions" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
                          <VersionPanel onCommitClick={() => setCommitDialogOpen(true)} />
                        </TabsContent>

                        {/* Annotations Tab */}
                        <TabsContent value="annotations" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
                          <AnnotationList instance={pspdfkitInstanceRef.current} />
                        </TabsContent>
                      </Tabs>
                    </div>
                  </aside>
                </>
              )}
            </div>
          </>
        )}

        {/* Commit Dialog */}
        {hasDocument && (
          <CommitDialog
            open={commitDialogOpen}
            onOpenChange={setCommitDialogOpen}
            instance={pspdfkitInstanceRef.current}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
