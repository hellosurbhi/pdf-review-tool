/**
 * Diff API Route
 *
 * GET /api/documents/:id/diff?v1=<versionId>&v2=<versionId>
 * Return text diff and annotation diff between two versions
 */

import { NextRequest, NextResponse } from 'next/server';
import DiffMatchPatch from 'diff-match-patch';
import { store } from '../../../_store';
import type { StoredVersion } from '../../../_store';

interface Params {
  params: Promise<{ id: string }>;
}

interface PageText {
  pageIndex: number;
  text: string;
}

interface AnnotationEntry {
  id: string;
  type: string;
  pageIndex: number;
  contents?: string;
  color?: string;
}

const dmp = new DiffMatchPatch();

/** Parse textContent JSON into PageText array */
function parseTextContent(textContent: string): PageText[] {
  try {
    const parsed = JSON.parse(textContent);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* empty */ }
  return [];
}

/** Parse annotations JSON into flat array */
function parseAnnotations(json: string): AnnotationEntry[] {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.annotations)) {
      return parsed.annotations.map((a: Record<string, unknown>) => ({
        id: String(a.id ?? ''),
        type: String(a.type ?? 'unknown'),
        pageIndex: typeof a.pageIndex === 'number' ? a.pageIndex : 0,
        contents: typeof a.text === 'string' ? a.text : (typeof a.contents === 'string' ? a.contents : undefined),
        color: typeof a.color === 'string' ? a.color : undefined,
      }));
    }
    if (Array.isArray(parsed)) {
      return parsed.map((a: Record<string, unknown>) => ({
        id: String(a.id ?? ''),
        type: String(a.type ?? 'unknown'),
        pageIndex: typeof a.pageIndex === 'number' ? a.pageIndex : 0,
        contents: typeof a.contents === 'string' ? a.contents : undefined,
        color: typeof a.color === 'string' ? a.color : undefined,
      }));
    }
  } catch { /* empty */ }
  return [];
}

/** Compute text diffs between two versions */
function computeTextDiffs(base: StoredVersion, compare: StoredVersion) {
  const basePages = parseTextContent(base.textContent);
  const comparePages = parseTextContent(compare.textContent);
  const maxPages = Math.max(basePages.length, comparePages.length);
  const results = [];

  for (let i = 0; i < maxPages; i++) {
    const oldText = basePages.find((p) => p.pageIndex === i)?.text ?? '';
    const newText = comparePages.find((p) => p.pageIndex === i)?.text ?? '';
    const diffs = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diffs);

    const hasChanges = diffs.some(([op]: [number, string]) => op !== 0);
    let addedCount = 0;
    let removedCount = 0;
    for (const [op, text] of diffs) {
      if (op === 1) addedCount += text.length;
      if (op === -1) removedCount += text.length;
    }

    results.push({ pageIndex: i, changes: diffs, hasChanges, addedCount, removedCount });
  }

  return results;
}

/** Compute annotation diffs between two versions */
function computeAnnotationDiffs(base: StoredVersion, compare: StoredVersion) {
  const baseAnns = parseAnnotations(base.annotations);
  const compareAnns = parseAnnotations(compare.annotations);
  const baseMap = new Map(baseAnns.map((a) => [a.id, a]));
  const compareMap = new Map(compareAnns.map((a) => [a.id, a]));

  const added: AnnotationEntry[] = [];
  const deleted: AnnotationEntry[] = [];
  const modified: { old: AnnotationEntry; new: AnnotationEntry }[] = [];

  for (const [id, newAnn] of compareMap) {
    const oldAnn = baseMap.get(id);
    if (!oldAnn) {
      added.push(newAnn);
    } else if (
      oldAnn.contents !== newAnn.contents ||
      oldAnn.color !== newAnn.color ||
      oldAnn.pageIndex !== newAnn.pageIndex ||
      oldAnn.type !== newAnn.type
    ) {
      modified.push({ old: oldAnn, new: newAnn });
    }
  }

  for (const [id, oldAnn] of baseMap) {
    if (!compareMap.has(id)) {
      deleted.push(oldAnn);
    }
  }

  return { added, deleted, modified };
}

/**
 * GET /api/documents/:id/diff?v1=<versionId>&v2=<versionId>
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const doc = store.documents.get(id);

    if (!doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const v1 = url.searchParams.get('v1');
    const v2 = url.searchParams.get('v2');

    if (!v1 || !v2) {
      return NextResponse.json(
        { error: 'Both "v1" and "v2" query parameters are required.' },
        { status: 400 }
      );
    }

    const baseVersion = store.versions.get(v1);
    const compareVersion = store.versions.get(v2);

    if (!baseVersion || baseVersion.documentId !== id) {
      return NextResponse.json(
        { error: `Version "${v1}" not found for this document.` },
        { status: 404 }
      );
    }

    if (!compareVersion || compareVersion.documentId !== id) {
      return NextResponse.json(
        { error: `Version "${v2}" not found for this document.` },
        { status: 404 }
      );
    }

    const textDiffs = computeTextDiffs(baseVersion, compareVersion);
    const annotationDiffs = computeAnnotationDiffs(baseVersion, compareVersion);

    const textChangesCount = textDiffs.filter((d) => d.hasChanges).length;

    return NextResponse.json({
      baseVersionId: v1,
      compareVersionId: v2,
      textDiffs,
      annotationChanges: annotationDiffs,
      summary: {
        totalChanges: textChangesCount + annotationDiffs.added.length + annotationDiffs.deleted.length + annotationDiffs.modified.length,
        textChanges: textChangesCount,
        annotationsAdded: annotationDiffs.added.length,
        annotationsRemoved: annotationDiffs.deleted.length,
        annotationsModified: annotationDiffs.modified.length,
      },
    });
  } catch (err) {
    console.error('GET /api/documents/:id/diff error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
