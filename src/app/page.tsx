'use client';

/**
 * Main Application Page
 *
 * Layout structure:
 * - Header bar (top)
 * - Left sidebar (240px): Page thumbnails
 * - Main content: PDF viewer
 * - Right sidebar (280px): Version history
 */

import { useState, useCallback, useRef } from 'react';
import {
  FileText,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const pspdfkitInstanceRef = useRef<PSPDFKitInstanceType | null>(null);

  const { currentDocument } = useDocumentStore();
  const { versions, currentVersionId } = useVersionStore();

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

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="flex items-center justify-between h-14 px-4 border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">PDF Review Tool</span>
            </div>
            <Separator orientation="vertical" className="h-6" />
            {currentDocument && (
              <span className="text-sm text-muted-foreground">
                {currentDocument.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload PDF</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" disabled={!currentDocument}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Page Thumbnails */}
          <aside
            className={`
              ${leftSidebarOpen ? 'w-60' : 'w-0'}
              flex-shrink-0 border-r bg-muted/30
              transition-all duration-200 overflow-hidden
            `}
          >
            <div className="w-60 h-full flex flex-col">
              <div className="flex items-center justify-between p-3 border-b">
                <span className="text-sm font-medium">Pages</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setLeftSidebarOpen(false)}
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Close sidebar</TooltipContent>
                </Tooltip>
              </div>
              {currentDocument && totalPages > 0 ? (
                <PageThumbnails
                  totalPages={totalPages}
                  currentPage={currentPage}
                  onPageSelect={handlePageSelect}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center p-4">
                  <p className="text-sm text-muted-foreground text-center">
                    {currentDocument ? 'Loading pages...' : 'No document loaded'}
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
                  className="absolute left-2 top-20 z-10"
                  onClick={() => setLeftSidebarOpen(true)}
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Show pages</TooltipContent>
            </Tooltip>
          )}

          {/* Main PDF Viewer Area */}
          <main className="flex-1 flex flex-col min-w-0 bg-muted/10">
            {!currentDocument ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md px-4">
                  <FileText className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No document loaded</h2>
                  <p className="text-muted-foreground mb-6">
                    Upload a PDF document to start reviewing, annotating, and tracking versions.
                  </p>
                  <Button onClick={() => setUploadDialogOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload PDF
                  </Button>
                </div>
              </div>
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

          {/* Toggle Right Sidebar Button (when closed) */}
          {!rightSidebarOpen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-20 z-10"
                  onClick={() => setRightSidebarOpen(true)}
                >
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Show versions</TooltipContent>
            </Tooltip>
          )}

          {/* Right Sidebar - Version History */}
          <aside
            className={`
              ${rightSidebarOpen ? 'w-70' : 'w-0'}
              flex-shrink-0 border-l bg-card
              transition-all duration-200 overflow-hidden
            `}
          >
            <div className="w-70 h-full flex flex-col">
              <div className="flex items-center justify-between p-3 border-b">
                <span className="text-sm font-medium">Version History</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
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
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No versions yet
                    </p>
                  ) : (
                    versions.map((version) => (
                      <div
                        key={version.id}
                        className={`
                          p-3 rounded-lg border cursor-pointer
                          ${version.id === currentVersionId
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">
                            V{version.versionNumber}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(version.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {version.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              {currentDocument && (
                <div className="p-3 border-t">
                  <Button className="w-full" variant="outline">
                    Create Version
                  </Button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Upload Dialog */}
      <PDFUploader
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />
    </TooltipProvider>
  );
}
