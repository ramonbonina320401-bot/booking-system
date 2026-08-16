import { create } from 'zustand'

// ---------------------------------------------------------------------------
// useSettingsDraft — shared draft store for the admin Settings panel.
//
// Why a store instead of local component state: the auto-save-on-navigation
// feature needs the draft + dirty flag to survive the SettingsPanel unmounting
// when the admin switches pages (BrowserRouter has no data-router blocker).
// The AdminLayout observes route changes and flushes any dirty draft through
// the module-level saver registered by the panel (see lib/settingsAutosave).
// ---------------------------------------------------------------------------

export interface BrandingDraft {
  app_name: string
  logo_url: string
  logo_width: number
  logo_height: number
  primary_color: string
  accent_color: string
  maintenance_mode: boolean
  maintenance_message: string
}

interface SettingsDraftState {
  /** Current draft (null until the panel initializes it from saved values). */
  draft: BrandingDraft | null
  /** True when the draft differs from the last-saved values. */
  isDirty: boolean
  /** Seed the store from saved values (only when empty — keeps a failed-save
   *  draft around so the admin doesn't lose edits by navigating away). */
  initialize: (values: BrandingDraft) => void
  /** Apply a partial update to the draft and mark it dirty. */
  update: (patch: Partial<BrandingDraft>) => void
  /** Revert the draft to the given saved values. */
  discard: (saved: BrandingDraft) => void
  /** Clear the dirty flag after a successful save. */
  markClean: () => void
}

export const useSettingsDraft = create<SettingsDraftState>((set) => ({
  draft: null,
  isDirty: false,

  initialize: (values) =>
    set((s) => (s.draft === null ? { draft: values, isDirty: false } : s)),

  update: (patch) =>
    set((s) => ({
      draft: s.draft ? { ...s.draft, ...patch } : s.draft,
      isDirty: true,
    })),

  discard: (saved) => set({ draft: saved, isDirty: false }),

  markClean: () => set({ isDirty: false }),
}))
