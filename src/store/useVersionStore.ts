/**
 * Version Store
 *
 * Zustand store for managing version history and comparison state.
 * Version data (PDF ArrayBuffer) is stored in IndexedDB, only metadata here.
 */

import { create } from 'zustand';
import type { VersionMetadata, DiffResult, VersionState } from '@/types';

const initialState = {
  versions: [] as VersionMetadata[],
  currentVersionId: null as string | null,
  compareVersionId: null as string | null,
  diffResult: null as DiffResult | null,
  isComparing: false,
  isLoading: false,
  error: null as string | null,
};

export const useVersionStore = create<VersionState>((set, get) => ({
  ...initialState,

  setVersions: (versions) =>
    set({
      versions: versions.sort((a, b) => b.versionNumber - a.versionNumber),
    }),

  addVersion: (version) =>
    set((state) => ({
      versions: [version, ...state.versions.filter((v) => v.id !== version.id)].sort(
        (a, b) => b.versionNumber - a.versionNumber
      ),
      currentVersionId: version.id,
    })),

  setCurrentVersion: (id) =>
    set({
      currentVersionId: id,
      // Clear comparison when switching versions
      compareVersionId: null,
      diffResult: null,
      isComparing: false,
    }),

  setCompareVersion: (id) => {
    const state = get();
    set({
      compareVersionId: id,
      isComparing: id !== null && state.currentVersionId !== null,
    });
  },

  setDiffResult: (result) => set({ diffResult: result }),

  setIsComparing: (comparing) =>
    set({
      isComparing: comparing,
      // Clear diff result when exiting compare mode
      diffResult: comparing ? get().diffResult : null,
      compareVersionId: comparing ? get().compareVersionId : null,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  reset: () => set(initialState),
}));

/**
 * Selector hooks for common patterns
 */
export const useVersions = () =>
  useVersionStore((state) => state.versions);

export const useCurrentVersion = () =>
  useVersionStore((state) => {
    const { versions, currentVersionId } = state;
    return versions.find((v) => v.id === currentVersionId) ?? null;
  });

export const useCompareVersion = () =>
  useVersionStore((state) => {
    const { versions, compareVersionId } = state;
    return versions.find((v) => v.id === compareVersionId) ?? null;
  });

export const useIsComparing = () =>
  useVersionStore((state) => state.isComparing);

export const useDiffResult = () =>
  useVersionStore((state) => state.diffResult);

export const useVersionLoading = () =>
  useVersionStore((state) => ({
    isLoading: state.isLoading,
    error: state.error,
  }));
