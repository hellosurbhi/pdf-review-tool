/**
 * Single Document API Route
 *
 * GET /api/documents/:id - Return document metadata including version list
 */

import { NextRequest, NextResponse } from 'next/server';
import { store } from '../../_store';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/documents/:id
 * Return document metadata with full version list
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

    return NextResponse.json({
      id: doc.id,
      name: doc.name,
      createdAt: doc.createdAt.toISOString(),
      currentVersionId: doc.currentVersionId,
      versions,
    });
  } catch (err) {
    console.error('GET /api/documents/:id error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
