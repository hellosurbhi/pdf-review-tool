'use client';

/**
 * PDFUploader Component
 *
 * Drag-and-drop PDF upload with file validation.
 * - Accepts only PDF files
 * - Max file size: 50MB
 * - Creates document and initial version in IndexedDB
 */

import { useCallback, useState } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useVersionStore } from '@/store/useVersionStore';
import { documentOps, versionOps, generateId } from '@/lib/db';
import type { PDFDocument, Version } from '@/types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = ['application/pdf'];

interface PDFUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PDFUploader({ open, onOpenChange }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { addDocument, setLoading } = useDocumentStore();
  const { addVersion, setVersions } = useVersionStore();

  /**
   * Validate file type and size
   */
  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Please upload a PDF file';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    return null;
  }, []);

  /**
   * Handle file selection from drag-drop or file picker
   */
  const handleFileSelect = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      setSelectedFile(file);
    },
    [validateFile]
  );

  /**
   * Process and upload the selected file
   */
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setLoading(true);

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await selectedFile.arrayBuffer();

      // Create document record
      const docId = generateId();
      const versionId = generateId();

      const document: PDFDocument = {
        id: docId,
        name: selectedFile.name,
        createdAt: new Date(),
        currentVersionId: versionId,
      };

      // Create initial version
      const version: Version = {
        id: versionId,
        documentId: docId,
        versionNumber: 1,
        message: 'Initial upload',
        pdfData: arrayBuffer,
        annotations: '[]',
        textContent: '', // Will be extracted by PSPDFKit later
        createdAt: new Date(),
      };

      // Save to IndexedDB
      await documentOps.create(document);
      await versionOps.create(version);

      // Update stores
      addDocument(document);
      setVersions([version]);
      addVersion(version);

      toast.success(`Uploaded ${selectedFile.name}`);
      onOpenChange(false);
      setSelectedFile(null);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload PDF. Please try again.');
    } finally {
      setIsUploading(false);
      setLoading(false);
    }
  };

  /**
   * Drag event handlers
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  /**
   * File input change handler
   */
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  /**
   * Reset state when dialog closes
   */
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedFile(null);
      setIsDragging(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload PDF</DialogTitle>
          <DialogDescription>
            Drag and drop a PDF file or click to browse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-8
              transition-colors cursor-pointer
              ${isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }
              ${selectedFile ? 'bg-muted/30' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <Upload className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Drop your PDF here or click to browse
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Max file size: 50MB
                </p>
              </div>
            )}
          </div>

          {/* Upload button */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
