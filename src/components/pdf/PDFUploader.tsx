'use client';

/**
 * PDFUploader Component
 *
 * Full-screen drop zone for PDF upload when no document is loaded.
 * - Drag-and-drop with animated visual feedback
 * - File picker fallback via "Browse Files" button
 * - Validates PDF type and 50MB size limit
 * - Creates document + V1 in IndexedDB on success
 */

import { useCallback, useState, useRef } from 'react';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useVersionStore } from '@/store/useVersionStore';
import { documentOps, versionOps, generateId } from '@/lib/db';
import type { PDFDocument, Version, VersionMetadata } from '@/types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = ['application/pdf'];

export function PDFUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addDocument, setLoading } = useDocumentStore();
  const { addVersion, setVersions } = useVersionStore();

  /**
   * Validate file type and size
   */
  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.endsWith('.pdf')) {
      return 'Only PDF files are accepted';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large — maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    return null;
  }, []);

  /**
   * Process the selected file: validate, read, store in IndexedDB
   */
  const processFile = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }

      setIsUploading(true);
      setLoading(true);

      try {
        const arrayBuffer = await file.arrayBuffer();

        const docId = generateId();
        const versionId = generateId();

        const document: PDFDocument = {
          id: docId,
          name: file.name,
          createdAt: new Date(),
          currentVersionId: versionId,
        };

        const version: Version = {
          id: versionId,
          documentId: docId,
          versionNumber: 1,
          message: 'Initial upload',
          pdfData: arrayBuffer,
          annotations: '[]',
          textContent: '',
          createdAt: new Date(),
        };

        await documentOps.create(document);
        await versionOps.create(version);

        // Store only metadata (no pdfData) in Zustand
        const { pdfData: _pdfData, ...metadata }: Version = version;
        void _pdfData;

        addDocument(document);
        setVersions([metadata]);
        addVersion(metadata);

        toast.success('Document uploaded — Version 1 created');
      } catch (err) {
        console.error('Upload failed:', err);
        toast.error('Failed to upload PDF. Please try again.');
      } finally {
        setIsUploading(false);
        setLoading(false);
      }
    },
    [validateFile, addDocument, addVersion, setVersions, setLoading]
  );

  /**
   * Drag event handlers with counter to prevent flicker from child elements
   */
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processFile]
  );

  return (
    <div
      className={`
        flex-1 flex items-center justify-center relative
        transition-all duration-300 ease-out
        ${isDragging
          ? 'bg-blue-500/5'
          : 'bg-gradient-to-b from-muted/20 to-muted/5'
        }
      `}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Full-screen drop zone overlay */}
      <div
        className={`
          absolute inset-4 rounded-2xl border-2 transition-all duration-300 ease-out pointer-events-none
          ${isDragging
            ? 'border-solid border-blue-500 bg-blue-500/5 scale-[0.99]'
            : 'border-dashed border-muted-foreground/20'
          }
        `}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Center content */}
      <div className="relative z-10 text-center max-w-md px-8">
        {isUploading ? (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Processing document...
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Reading PDF and creating initial version
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Icon */}
            <div
              className={`
                mx-auto w-20 h-20 rounded-2xl flex items-center justify-center
                transition-all duration-300 ease-out
                ${isDragging
                  ? 'bg-blue-500/10 scale-110'
                  : 'bg-muted/50'
                }
              `}
            >
              {isDragging ? (
                <FileText
                  className="h-10 w-10 text-blue-500 transition-all duration-300 animate-bounce"
                />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground/60" />
              )}
            </div>

            {/* Text */}
            <div className="space-y-2">
              <h2
                className={`
                  text-xl font-semibold transition-colors duration-200
                  ${isDragging ? 'text-blue-500' : 'text-foreground'}
                `}
              >
                {isDragging ? 'Drop your PDF here' : 'Upload a PDF to get started'}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Drag and drop a PDF file here, or click the button below
                to browse your files.
              </p>
            </div>

            {/* Browse button */}
            <Button
              size="lg"
              className="px-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Browse Files
            </Button>

            {/* Constraints */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
              <AlertCircle className="h-3 w-3" />
              <span>PDF files only, up to 50MB</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
