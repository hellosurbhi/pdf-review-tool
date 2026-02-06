/**
 * Diff Utilities
 *
 * Text and annotation comparison between document versions.
 * Uses diff-match-patch for text diffing, custom logic for annotation comparison.
 */

import DiffMatchPatch from 'diff-match-patch';
import { versionOps } from '@/lib/db';
import type {
  TextDiff,
  DiffResult,
  DiffSummary,
  AnnotationDiffResult,
  AnnotationDiffEntry,
  AnnotationChange,
  PageText,
} from '@/types';

const dmp = new DiffMatchPatch();

/**
 * Parse stored textContent JSON into PageText array.
 * textContent is stored as JSON: [{ pageIndex: 0, text: "..." }, ...]
 */
function parseTextContent(textContent: string): PageText[] {
  try {
    const parsed = JSON.parse(textContent);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fallback for plain string content
  }
  return [];
}

/**
 * Compute per-page text diffs between two versions.
 * Loads textContent from IndexedDB for both versions and runs diff-match-patch.
 */
export async function computeTextDiff(
  baseVersionId: string,
  compareVersionId: string
): Promise<TextDiff[]> {
  const [baseVersion, compareVersion] = await Promise.all([
    versionOps.getById(baseVersionId),
    versionOps.getById(compareVersionId),
  ]);

  if (!baseVersion || !compareVersion) {
    throw new Error('One or both versions not found');
  }

  const basePages = parseTextContent(baseVersion.textContent);
  const comparePages = parseTextContent(compareVersion.textContent);

  // Determine page count as max of both versions
  const maxPages = Math.max(basePages.length, comparePages.length);
  const results: TextDiff[] = [];

  for (let i = 0; i < maxPages; i++) {
    const oldText = basePages.find((p) => p.pageIndex === i)?.text ?? '';
    const newText = comparePages.find((p) => p.pageIndex === i)?.text ?? '';

    const diffs = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diffs);

    const hasChanges = diffs.some(([op]) => op !== 0);
    let addedCount = 0;
    let removedCount = 0;

    for (const [op, text] of diffs) {
      if (op === 1) addedCount += text.length;
      if (op === -1) removedCount += text.length;
    }

    results.push({
      pageIndex: i,
      changes: diffs,
      hasChanges,
      addedCount,
      removedCount,
    });
  }

  return results;
}

/**
 * Parse annotations JSON from a version record into a flat array.
 * Handles both Instant JSON format ({ annotations: [...] }) and plain arrays.
 */
function parseAnnotations(annotationsJson: string): AnnotationDiffEntry[] {
  try {
    const parsed = JSON.parse(annotationsJson);

    // Instant JSON format from PSPDFKit
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.annotations)) {
      return parsed.annotations.map((ann: Record<string, unknown>) => ({
        id: String(ann.id ?? ''),
        type: String(ann.type ?? 'unknown'),
        pageIndex: typeof ann.pageIndex === 'number' ? ann.pageIndex : 0,
        contents: typeof ann.text === 'string' ? ann.text : (typeof ann.contents === 'string' ? ann.contents : undefined),
        color: typeof ann.color === 'string' ? ann.color : undefined,
        boundingBox: ann.bbox && typeof ann.bbox === 'object' ? ann.bbox as AnnotationDiffEntry['boundingBox'] : undefined,
      }));
    }

    // Plain array
    if (Array.isArray(parsed)) {
      return parsed.map((ann: Record<string, unknown>) => ({
        id: String(ann.id ?? ''),
        type: String(ann.type ?? 'unknown'),
        pageIndex: typeof ann.pageIndex === 'number' ? ann.pageIndex : 0,
        contents: typeof ann.contents === 'string' ? ann.contents : undefined,
        color: typeof ann.color === 'string' ? ann.color : undefined,
      }));
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Compute annotation diff between two versions.
 * Detects added, deleted, and modified annotations by comparing IDs.
 */
export async function computeAnnotationDiff(
  baseVersionId: string,
  compareVersionId: string
): Promise<AnnotationDiffResult> {
  const [baseVersion, compareVersion] = await Promise.all([
    versionOps.getById(baseVersionId),
    versionOps.getById(compareVersionId),
  ]);

  if (!baseVersion || !compareVersion) {
    throw new Error('One or both versions not found');
  }

  const baseAnnotations = parseAnnotations(baseVersion.annotations);
  const compareAnnotations = parseAnnotations(compareVersion.annotations);

  const baseMap = new Map(baseAnnotations.map((a) => [a.id, a]));
  const compareMap = new Map(compareAnnotations.map((a) => [a.id, a]));

  const added: AnnotationDiffEntry[] = [];
  const deleted: AnnotationDiffEntry[] = [];
  const modified: { old: AnnotationDiffEntry; new: AnnotationDiffEntry }[] = [];

  // Find added and modified
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

  // Find deleted
  for (const [id, oldAnn] of baseMap) {
    if (!compareMap.has(id)) {
      deleted.push(oldAnn);
    }
  }

  return { added, deleted, modified };
}

/**
 * Compute full diff result between two versions (text + annotations).
 */
export async function computeFullDiff(
  baseVersionId: string,
  compareVersionId: string
): Promise<DiffResult> {
  const [textDiffs, annotationDiff] = await Promise.all([
    computeTextDiff(baseVersionId, compareVersionId),
    computeAnnotationDiff(baseVersionId, compareVersionId),
  ]);

  // Convert annotation diff to AnnotationChange[] for DiffResult
  const annotationChanges: AnnotationChange[] = [
    ...annotationDiff.added.map((ann): AnnotationChange => ({
      type: 'added',
      annotation: {
        id: ann.id,
        type: ann.type as import('@/types').AnnotationType,
        pageIndex: ann.pageIndex,
        rect: ann.boundingBox ?? { left: 0, top: 0, width: 0, height: 0 },
        contents: ann.contents,
        color: ann.color,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      pageIndex: ann.pageIndex,
      description: `Added ${ann.type} annotation${ann.contents ? `: "${ann.contents.slice(0, 50)}"` : ''}`,
    })),
    ...annotationDiff.deleted.map((ann): AnnotationChange => ({
      type: 'removed',
      annotation: {
        id: ann.id,
        type: ann.type as import('@/types').AnnotationType,
        pageIndex: ann.pageIndex,
        rect: ann.boundingBox ?? { left: 0, top: 0, width: 0, height: 0 },
        contents: ann.contents,
        color: ann.color,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      pageIndex: ann.pageIndex,
      description: `Removed ${ann.type} annotation${ann.contents ? `: "${ann.contents.slice(0, 50)}"` : ''}`,
    })),
    ...annotationDiff.modified.map((pair): AnnotationChange => ({
      type: 'modified',
      annotation: {
        id: pair.new.id,
        type: pair.new.type as import('@/types').AnnotationType,
        pageIndex: pair.new.pageIndex,
        rect: pair.new.boundingBox ?? { left: 0, top: 0, width: 0, height: 0 },
        contents: pair.new.contents,
        color: pair.new.color,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      previousAnnotation: {
        id: pair.old.id,
        type: pair.old.type as import('@/types').AnnotationType,
        pageIndex: pair.old.pageIndex,
        rect: pair.old.boundingBox ?? { left: 0, top: 0, width: 0, height: 0 },
        contents: pair.old.contents,
        color: pair.old.color,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      pageIndex: pair.new.pageIndex,
      description: `Modified ${pair.new.type} annotation on page ${pair.new.pageIndex + 1}`,
    })),
  ];

  const textChangesCount = textDiffs.filter((d) => d.hasChanges).length;

  const summary: DiffSummary = {
    totalChanges: textChangesCount + annotationChanges.length,
    textChanges: textChangesCount,
    annotationsAdded: annotationDiff.added.length,
    annotationsRemoved: annotationDiff.deleted.length,
    annotationsModified: annotationDiff.modified.length,
  };

  return {
    versionAId: baseVersionId,
    versionBId: compareVersionId,
    textDiffs,
    annotationChanges,
    summary,
  };
}
