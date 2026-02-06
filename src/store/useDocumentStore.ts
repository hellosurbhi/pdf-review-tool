/**
 * Document Store
 *
 * Zustand store for managing document state.
 * PDF data is stored in IndexedDB, only metadata is kept in this store.
 */

import { create } from 'zustand';
import type { PDFDocument, DocumentState } from '@/types';

const initialState = {
  currentDocument: null as PDFDocument | null,
  documents: [] as PDFDocument[],
  isLoading: false,
  error: null as string | null,
};

export const useDocumentStore = create<DocumentState>((set) => ({
  ...initialState,

  setCurrentDocument: (doc) =>
    set({
      currentDocument: doc,
      error: null,
    }),

  addDocument: (doc) =>
    set((state) => ({
      documents: [doc, ...state.documents],
      currentDocument: doc,
    })),

  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      currentDocument:
        state.currentDocument?.id === id ? null : state.currentDocument,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  reset: () => set(initialState),
}));

/**
 * Selector hooks for common patterns
 */
export const useCurrentDocument = () =>
  useDocumentStore((state) => state.currentDocument);

export const useDocuments = () =>
  useDocumentStore((state) => state.documents);

export const useDocumentLoading = () =>
  useDocumentStore((state) => ({
    isLoading: state.isLoading,
    error: state.error,
  }));
