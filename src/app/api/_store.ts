/**
 * In-Memory Store for Mock Backend API
 *
 * Simple Map-based storage for documents and versions.
 * Data persists only for the lifetime of the server process.
 * Production would use PostgreSQL + S3.
 */

/** Stored document metadata */
export interface StoredDocument {
  id: string;
  name: string;
  createdAt: Date;
  currentVersionId: string | null;
}

/** Stored version with PDF data */
export interface StoredVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  message: string;
  pdfData: ArrayBuffer;
  annotations: string;
  textContent: string;
  createdAt: Date;
}

/** Version metadata (without binary PDF data) */
export interface VersionMetadata {
  id: string;
  documentId: string;
  versionNumber: number;
  message: string;
  annotations: string;
  textContent: string;
  createdAt: string;
}

/** In-memory storage singleton */
class InMemoryStore {
  documents = new Map<string, StoredDocument>();
  versions = new Map<string, StoredVersion>();

  /** Get all versions for a document, sorted by version number */
  getVersions(documentId: string): StoredVersion[] {
    return Array.from(this.versions.values())
      .filter((v) => v.documentId === documentId)
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }

  /** Get the latest version number for a document */
  getLatestVersionNumber(documentId: string): number {
    const versions = this.getVersions(documentId);
    return versions.length > 0 ? versions[versions.length - 1].versionNumber : 0;
  }

  /** Convert a stored version to metadata (no pdfData) */
  toVersionMetadata(v: StoredVersion): VersionMetadata {
    return {
      id: v.id,
      documentId: v.documentId,
      versionNumber: v.versionNumber,
      message: v.message,
      annotations: v.annotations,
      textContent: v.textContent,
      createdAt: v.createdAt.toISOString(),
    };
  }
}

export const store = new InMemoryStore();

/** Generate a unique ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
