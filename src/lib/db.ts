/**
 * Dexie IndexedDB Database Configuration
 *
 * All PDF data is stored in IndexedDB, never in React state.
 * This ensures large binary files don't impact application performance.
 */

import Dexie, { type EntityTable } from 'dexie';

/**
 * Document record stored in IndexedDB
 */
export interface DBDocument {
  id: string;
  name: string;
  createdAt: Date;
  currentVersionId: string | null;
}

/**
 * Version record stored in IndexedDB
 * pdfData is stored as ArrayBuffer for efficient binary storage
 */
export interface DBVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  message: string;
  pdfData: ArrayBuffer;
  annotations: string; // JSON stringified
  textContent: string; // Extracted text for diffing
  createdAt: Date;
}

/**
 * PDF Review Database class using Dexie
 */
class PDFReviewDatabase extends Dexie {
  documents!: EntityTable<DBDocument, 'id'>;
  versions!: EntityTable<DBVersion, 'id'>;

  constructor() {
    super('PDFReviewDB');

    this.version(1).stores({
      documents: 'id, name, createdAt, currentVersionId',
      versions: 'id, documentId, versionNumber, createdAt',
    });
  }
}

/**
 * Singleton database instance
 */
export const db = new PDFReviewDatabase();

/**
 * Generate a unique ID using timestamp + random string
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Document operations
 */
export const documentOps = {
  /**
   * Get all documents ordered by creation date (newest first)
   */
  async getAll(): Promise<DBDocument[]> {
    try {
      return await db.documents.orderBy('createdAt').reverse().toArray();
    } catch (error) {
      console.error('Failed to get documents:', error);
      throw error;
    }
  },

  /**
   * Get a document by ID
   */
  async getById(id: string): Promise<DBDocument | undefined> {
    try {
      return await db.documents.get(id);
    } catch (error) {
      console.error('Failed to get document:', error);
      throw error;
    }
  },

  /**
   * Create a new document
   */
  async create(doc: DBDocument): Promise<string> {
    try {
      await db.documents.add(doc);
      return doc.id;
    } catch (error) {
      console.error('Failed to create document:', error);
      throw error;
    }
  },

  /**
   * Update a document
   */
  async update(id: string, updates: Partial<DBDocument>): Promise<void> {
    try {
      await db.documents.update(id, updates);
    } catch (error) {
      console.error('Failed to update document:', error);
      throw error;
    }
  },

  /**
   * Delete a document and all its versions
   */
  async delete(id: string): Promise<void> {
    try {
      await db.transaction('rw', [db.documents, db.versions], async () => {
        await db.versions.where('documentId').equals(id).delete();
        await db.documents.delete(id);
      });
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  },
};

/**
 * Version operations
 */
export const versionOps = {
  /**
   * Get all versions for a document ordered by version number
   */
  async getByDocumentId(documentId: string): Promise<DBVersion[]> {
    try {
      return await db.versions
        .where('documentId')
        .equals(documentId)
        .sortBy('versionNumber');
    } catch (error) {
      console.error('Failed to get versions:', error);
      throw error;
    }
  },

  /**
   * Get a version by ID
   */
  async getById(id: string): Promise<DBVersion | undefined> {
    try {
      return await db.versions.get(id);
    } catch (error) {
      console.error('Failed to get version:', error);
      throw error;
    }
  },

  /**
   * Create a new version
   */
  async create(version: DBVersion): Promise<string> {
    try {
      await db.versions.add(version);
      // Update document's current version
      await db.documents.update(version.documentId, {
        currentVersionId: version.id,
      });
      return version.id;
    } catch (error) {
      console.error('Failed to create version:', error);
      throw error;
    }
  },

  /**
   * Get the latest version number for a document
   */
  async getLatestVersionNumber(documentId: string): Promise<number> {
    try {
      const versions = await db.versions
        .where('documentId')
        .equals(documentId)
        .sortBy('versionNumber');
      return versions.length > 0 ? versions[versions.length - 1].versionNumber : 0;
    } catch (error) {
      console.error('Failed to get latest version number:', error);
      throw error;
    }
  },

  /**
   * Get PDF data for a version (returns ArrayBuffer)
   */
  async getPdfData(versionId: string): Promise<ArrayBuffer | undefined> {
    try {
      const version = await db.versions.get(versionId);
      return version?.pdfData;
    } catch (error) {
      console.error('Failed to get PDF data:', error);
      throw error;
    }
  },
};
