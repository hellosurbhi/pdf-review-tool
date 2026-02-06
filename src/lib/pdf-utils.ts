/**
 * PDF Utilities
 *
 * Export engine using pdf-lib to generate annotated PDFs with:
 * - Change log cover page (version history table)
 * - Inline callout boxes on affected pages
 */

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { versionOps } from '@/lib/db';
import type { Version } from '@/types';

/** Page dimensions for letter size */
const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

/** Margins */
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 60;

/** Callout box dimensions */
const CALLOUT_WIDTH = 150;
const CALLOUT_HEIGHT = 20;
const CALLOUT_PADDING = 5;
const CALLOUT_GAP = 4;

/**
 * Parse annotation data from a version to extract page-level change summaries.
 * Returns a map of pageIndex -> list of change descriptions.
 */
function extractChangesByPage(
  version: Version,
  prevVersion: Version | null
): Map<number, string[]> {
  const changes = new Map<number, string[]>();

  // Parse current version annotations
  let currentAnnotations: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(version.annotations);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.annotations)) {
      currentAnnotations = parsed.annotations;
    } else if (Array.isArray(parsed)) {
      currentAnnotations = parsed;
    }
  } catch {
    // Ignore parse errors
  }

  // Parse previous version annotations
  let prevAnnotations: Array<Record<string, unknown>> = [];
  if (prevVersion) {
    try {
      const parsed = JSON.parse(prevVersion.annotations);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.annotations)) {
        prevAnnotations = parsed.annotations;
      } else if (Array.isArray(parsed)) {
        prevAnnotations = parsed;
      }
    } catch {
      // Ignore parse errors
    }
  }

  const prevIds = new Set(prevAnnotations.map((a) => String(a.id ?? '')));
  const currentIds = new Set(currentAnnotations.map((a) => String(a.id ?? '')));

  // Detect added annotations
  for (const ann of currentAnnotations) {
    const id = String(ann.id ?? '');
    if (!prevIds.has(id)) {
      const pageIndex = typeof ann.pageIndex === 'number' ? ann.pageIndex : 0;
      const type = String(ann.type ?? 'annotation').replace('pspdfkit/', '');
      const existing = changes.get(pageIndex) ?? [];
      existing.push(`${type} added`);
      changes.set(pageIndex, existing);
    }
  }

  // Detect deleted annotations
  for (const ann of prevAnnotations) {
    const id = String(ann.id ?? '');
    if (!currentIds.has(id)) {
      const pageIndex = typeof ann.pageIndex === 'number' ? ann.pageIndex : 0;
      const type = String(ann.type ?? 'annotation').replace('pspdfkit/', '');
      const existing = changes.get(pageIndex) ?? [];
      existing.push(`${type} removed`);
      changes.set(pageIndex, existing);
    }
  }

  // If no annotation changes detected, mark as general update
  if (changes.size === 0) {
    changes.set(0, ['Document updated']);
  }

  return changes;
}

/**
 * Count total annotation changes for a version (vs. previous version).
 */
function countChanges(version: Version, prevVersion: Version | null): number {
  const changes = extractChangesByPage(version, prevVersion);
  let total = 0;
  for (const descs of changes.values()) {
    total += descs.length;
  }
  return total;
}

/**
 * Truncate a string to maxLen characters, adding ellipsis if needed.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Format a Date to a short readable string.
 */
function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Draw the change log cover page with version history table.
 */
function drawCoverPage(
  page: PDFPage,
  documentName: string,
  versions: Version[],
  helvetica: PDFFont,
  helveticaBold: PDFFont
) {
  const { width } = page.getSize();

  let y = LETTER_HEIGHT - MARGIN_TOP;

  // Title
  page.drawText('Document Change Log', {
    x: width / 2 - 120,
    y,
    size: 24,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 30;

  // Subtitle
  const subtitle = `${documentName} — Exported ${formatDate(new Date())}`;
  page.drawText(truncate(subtitle, 80), {
    x: MARGIN_LEFT,
    y,
    size: 11,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 20;

  // Horizontal line
  page.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: width - MARGIN_RIGHT, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 25;

  // Table header
  const colX = {
    version: MARGIN_LEFT,
    date: MARGIN_LEFT + 60,
    message: MARGIN_LEFT + 200,
    changes: width - MARGIN_RIGHT - 60,
  };
  const tableWidth = width - MARGIN_LEFT - MARGIN_RIGHT;
  const rowHeight = 22;

  // Header row background
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: y - 4,
    width: tableWidth,
    height: rowHeight,
    color: rgb(0.2, 0.2, 0.35),
  });

  const headerColor = rgb(1, 1, 1);
  page.drawText('Version', { x: colX.version + 5, y: y + 3, size: 9, font: helveticaBold, color: headerColor });
  page.drawText('Date', { x: colX.date + 5, y: y + 3, size: 9, font: helveticaBold, color: headerColor });
  page.drawText('Message', { x: colX.message + 5, y: y + 3, size: 9, font: helveticaBold, color: headerColor });
  page.drawText('Changes', { x: colX.changes + 5, y: y + 3, size: 9, font: helveticaBold, color: headerColor });
  y -= rowHeight;

  // Sort versions ascending for the table
  const sortedVersions = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);

  // Table rows
  for (let i = 0; i < sortedVersions.length; i++) {
    if (y < 60) break; // Stop if we run out of page space

    const version = sortedVersions[i];
    const prevVersion = i > 0 ? sortedVersions[i - 1] : null;
    const changes = countChanges(version, prevVersion);

    // Alternating row background
    if (i % 2 === 0) {
      page.drawRectangle({
        x: MARGIN_LEFT,
        y: y - 4,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.95, 0.95, 0.97),
      });
    }

    const rowColor = rgb(0.15, 0.15, 0.15);
    page.drawText(`V${version.versionNumber}`, {
      x: colX.version + 5, y: y + 3, size: 9, font: helveticaBold, color: rowColor,
    });
    page.drawText(formatDate(version.createdAt), {
      x: colX.date + 5, y: y + 3, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4),
    });
    page.drawText(truncate(version.message, 80), {
      x: colX.message + 5, y: y + 3, size: 8, font: helvetica, color: rowColor,
    });
    page.drawText(String(changes), {
      x: colX.changes + 20, y: y + 3, size: 9, font: helvetica, color: rowColor,
    });

    y -= rowHeight;
  }
}

/**
 * Draw inline callout boxes on affected pages.
 */
function drawCallouts(
  pdfDoc: PDFDocument,
  versions: Version[],
  helvetica: PDFFont
) {
  const sortedVersions = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);

  // Collect all callouts by page index (0-indexed, but offset +1 because cover page is at 0)
  const calloutsByPage = new Map<number, { label: string }[]>();

  for (let i = 1; i < sortedVersions.length; i++) {
    const version = sortedVersions[i];
    const prevVersion = sortedVersions[i - 1];
    const changesByPage = extractChangesByPage(version, prevVersion);

    for (const [pageIndex, descriptions] of changesByPage) {
      // Offset by 1 for the inserted cover page
      const actualPageIndex = pageIndex + 1;
      const existing = calloutsByPage.get(actualPageIndex) ?? [];

      for (let d = 0; d < descriptions.length; d++) {
        existing.push({
          label: `V${version.versionNumber}-#${d + 1}: ${truncate(descriptions[d], 30)}`,
        });
      }

      calloutsByPage.set(actualPageIndex, existing);
    }
  }

  // Draw callouts on each affected page
  const pageCount = pdfDoc.getPageCount();

  for (const [pageIndex, callouts] of calloutsByPage) {
    if (pageIndex >= pageCount) continue;

    const page = pdfDoc.getPage(pageIndex);
    const { width, height } = page.getSize();

    let yOffset = height - MARGIN_TOP;

    for (const callout of callouts) {
      const boxX = width - MARGIN_RIGHT - CALLOUT_WIDTH;
      const boxY = yOffset - CALLOUT_HEIGHT;

      // Light blue background
      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: CALLOUT_WIDTH,
        height: CALLOUT_HEIGHT,
        color: rgb(0.9, 0.95, 1.0),
        borderColor: rgb(0.3, 0.45, 0.7),
        borderWidth: 0.75,
      });

      // Callout text
      page.drawText(callout.label, {
        x: boxX + CALLOUT_PADDING,
        y: boxY + CALLOUT_PADDING + 1,
        size: 7,
        font: helvetica,
        color: rgb(0.15, 0.25, 0.5),
      });

      yOffset -= CALLOUT_HEIGHT + CALLOUT_GAP;
    }
  }
}

/**
 * Export an annotated PDF with changelog cover page and inline callouts.
 *
 * @param currentPdfData - ArrayBuffer of the current (latest) PDF
 * @param documentName - Name of the document
 * @param versions - All versions for the document
 */
export async function exportAnnotatedPDF(
  currentPdfData: ArrayBuffer,
  documentName: string,
  versions: Version[]
): Promise<void> {
  // Step 1: Load the current PDF
  const pdfDoc = await PDFDocument.load(currentPdfData);

  // Embed fonts once for reuse
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Step 2: Create change log cover page at index 0
  const coverPage = pdfDoc.insertPage(0, [LETTER_WIDTH, LETTER_HEIGHT]);
  drawCoverPage(coverPage, documentName, versions, helvetica, helveticaBold);

  // Step 3: Add inline callouts on affected pages
  drawCallouts(pdfDoc, versions, helvetica);

  // Step 4: Generate and trigger download
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${documentName.replace(/\.pdf$/i, '')}-annotated.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Load all version data from IndexedDB for a document and export annotated PDF.
 */
export async function exportAnnotatedPDFFromDB(
  documentId: string,
  documentName: string,
  currentVersionId: string
): Promise<void> {
  // Load current PDF data
  const pdfData = await versionOps.getPdfData(currentVersionId);
  if (!pdfData) {
    throw new Error('Current PDF data not found');
  }

  // Load all versions (metadata only — pdfData not needed for changelog)
  const dbVersions = await versionOps.getByDocumentId(documentId);
  const versions: Version[] = dbVersions.map((v) => ({
    ...v,
    pdfData: new ArrayBuffer(0),
  }));

  await exportAnnotatedPDF(pdfData, documentName, versions);
}
