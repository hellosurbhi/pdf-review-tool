/**
 * Versions API Route
 *
 * POST /api/documents/:id/versions - Create new version
 * GET  /api/documents/:id/versions - List all versions
 */

import { NextRequest, NextResponse } from 'next/server';
import { store, generateId } from '../../../_store';

interface Params {
  params: Promise<{ id: string }>;
}

/** Request body for creating a version */
interface CreateVersionBody {
  message: string;
  annotations?: string;
  textContent?: string;
  pdfData?: string; // base64-encoded PDF data
}

/**
 * POST /api/documents/:id/versions
 * Create a new version with message and annotations
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const doc = store.documents.get(id);

    if (!doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const body = (await request.json()) as CreateVersionBody;

    if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
      return NextResponse.json(
        { error: 'A non-empty "message" field is required.' },
        { status: 400 }
      );
    }

    const nextVersionNumber = store.getLatestVersionNumber(id) + 1;
    const versionId = generateId();

    // Decode base64 PDF data if provided, otherwise use empty buffer
    let pdfData: ArrayBuffer = new ArrayBuffer(0);
    if (body.pdfData) {
      const binary = atob(body.pdfData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      pdfData = bytes.buffer as ArrayBuffer;
    }

    store.versions.set(versionId, {
      id: versionId,
      documentId: id,
      versionNumber: nextVersionNumber,
      message: body.message.trim(),
      pdfData,
      annotations: body.annotations ?? '[]',
      textContent: body.textContent ?? '',
      createdAt: new Date(),
    });

    // Update document's current version
    doc.currentVersionId = versionId;

    const version = store.versions.get(versionId)!;
    return NextResponse.json(store.toVersionMetadata(version), { status: 201 });
  } catch (err) {
    console.error('POST /api/documents/:id/versions error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/:id/versions
 * Return all versions for a document
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const doc = store.documents.get(id);

    if (!doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const versions = store.getVersions(id).map((v) => store.toVersionMetadata(v));

    return NextResponse.json({ versions });
  } catch (err) {
    console.error('GET /api/documents/:id/versions error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
