'use client';

/**
 * Main Application Page
 *
 * Layout structure:
 * - Header bar (56px): title, version badge, commit/export buttons
 * - Left sidebar (240px): Page thumbnails, dark theme, collapsible
 * - Main content: PDF viewer or full-screen upload zone
 * - Right sidebar (280px): Version history, dark theme, collapsible
 */

import { useState, useCallback, useRef } from 'react';
import {
  FileText,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Download,
  GitCommitHorizontal,
  Clock,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  PDFUploader,
  PDFViewer,
  PageThumbnails,
  goToPage,
  type PSPDFKitInstanceType,
} from '@/components/pdf';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useVersionStore } from '@/store/useVersionStore';

export default function Home() {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const pspdfkitInstanceRef = useRef<PSPDFKitInstanceType | null>(null);

  const { currentDocument } = useDocumentStore();
  const { versions, currentVersionId } = useVersionStore();

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

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
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
                {currentVersion && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    V{currentVersion.versionNumber}
                  </Badge>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {currentDocument && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" disabled>
                      <GitCommitHorizontal className="h-4 w-4 mr-1.5" />
                      Commit
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create a new version</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export PDF</TooltipContent>
                </Tooltip>

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
                      <p className="text-sm text-slate-500 text-center">
                        Loading pages...
                      </p>
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
              <PDFUploader />
            ) : currentVersionId ? (
              <PDFViewer
                versionId={currentVersionId}
                onPageChange={setCurrentPage}
                onTotalPagesChange={setTotalPages}
                onInstanceReady={handleInstanceReady}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground">Loading document...</p>
              </div>
            )}
          </main>

          {/* Right Sidebar - Version History */}
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
                  <TooltipContent side="left">Show versions</TooltipContent>
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
                  <div className="flex items-center justify-between p-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-200">Version History</span>
                    </div>
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
                      <TooltipContent>Close sidebar</TooltipContent>
                    </Tooltip>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2">
                      {versions.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-8">
                          No versions yet
                        </p>
                      ) : (
                        versions.map((version) => (
                          <div
                            key={version.id}
                            className={`
                              p-3 rounded-lg border cursor-pointer transition-colors
                              ${version.id === currentVersionId
                                ? 'border-blue-500/50 bg-blue-500/10'
                                : 'border-white/10 hover:bg-white/5'
                              }
                            `}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <Badge
                                variant="secondary"
                                className={`
                                  text-xs font-mono px-1.5 py-0
                                  ${version.id === currentVersionId
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-white/10 text-slate-300'
                                  }
                                `}
                              >
                                V{version.versionNumber}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {new Date(version.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400 truncate">
                              {version.message}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  <div className="p-3 border-t border-white/10">
                    <Button
                      className="w-full"
                      variant="outline"
                      size="sm"
                      disabled
                    >
                      <GitCommitHorizontal className="h-4 w-4 mr-1.5" />
                      Create Version
                    </Button>
                  </div>
                </div>
              </aside>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
