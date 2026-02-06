/**
 * Annotation Store
 *
 * Zustand store for tracking annotations and unsaved changes.
 * Annotations are synced from PSPDFKit events; changes accumulate
 * until a version commit clears them.
 */

import { create } from 'zustand';
import type { TrackedAnnotation, AnnotationChangeRecord, AnnotationState } from '@/types';

const initialState = {
  annotations: [] as TrackedAnnotation[],
  pendingChanges: [] as AnnotationChangeRecord[],
};

export const useAnnotationStore = create<AnnotationState>((set) => ({
  ...initialState,

  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, annotation],
    })),

  updateAnnotation: (id, updates) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a
      ),
    })),

  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    })),

  setAnnotations: (annotations) => set({ annotations }),

  addChange: (change) =>
    set((state) => ({
      pendingChanges: [...state.pendingChanges, change],
    })),

  clearChanges: () => set({ pendingChanges: [] }),

  reset: () => set(initialState),
}));

/**
 * Selector hooks
 */
export const useAnnotations = () =>
  useAnnotationStore((state) => state.annotations);

export const usePendingChanges = () =>
  useAnnotationStore((state) => state.pendingChanges);

export const useUnsavedChangeCount = () =>
  useAnnotationStore((state) => state.pendingChanges.length);
