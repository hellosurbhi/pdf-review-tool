/**
 * Documents API Route
 *
 * POST /api/documents - Upload PDF, store in memory, return metadata
 * GET  /api/documents - List all documents with metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { store, generateId, type StoredDocument } from '../_store';

/** Response shape for a single document */
interface DocumentResponse {
  id: string;
  name: string;
  createdAt: string;
  currentVersionId: string | null;
  versionCount: number;
}

function toDocumentResponse(doc: StoredDocument): DocumentResponse {
  return {
    id: doc.id,
    name: doc.name,
    createdAt: doc.createdAt.toISOString(),
    currentVersionId: doc.currentVersionId,
    versionCount: store.getVersions(doc.id).length,
  };
}

/**
 * POST /api/documents
 * Accept PDF upload (multipart/form-data), store in memory
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Send a PDF as multipart form-data with field name "file".' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are accepted.' },
        { status: 400 }
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      );
    }

    const pdfData = await file.arrayBuffer();
    const docId = generateId();
    const versionId = generateId();

    const doc: StoredDocument = {
      id: docId,
      name: file.name,
      createdAt: new Date(),
      currentVersionId: versionId,
    };

    store.documents.set(docId, doc);
    store.versions.set(versionId, {
      id: versionId,
      documentId: docId,
      versionNumber: 1,
      message: 'Initial upload',
      pdfData,
      annotations: '[]',
      textContent: '',
      createdAt: new Date(),
    });

    return NextResponse.json(toDocumentResponse(doc), { status: 201 });
  } catch (err) {
    console.error('POST /api/documents error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents
 * Return list of all documents with metadata
 */
export async function GET() {
  try {
    const docs = Array.from(store.documents.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(toDocumentResponse);

    return NextResponse.json({ documents: docs });
  } catch (err) {
    console.error('GET /api/documents error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
