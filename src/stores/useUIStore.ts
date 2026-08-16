import { create } from 'zustand'

// ---------------------------------------------------------------------------
// UI store (Zustand) — sidebar, mobile nav, global modals, filters.
// ---------------------------------------------------------------------------

interface UIState {
  sidebarOpen: boolean
  mobileNavOpen: boolean
  /** True while the "first booking" celebration overlay is showing. */
  celebrationOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleMobileNav: () => void
  setMobileNavOpen: (open: boolean) => void
  openCelebration: () => void
  closeCelebration: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  mobileNavOpen: false,
  celebrationOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  openCelebration: () => set({ celebrationOpen: true }),
  closeCelebration: () => set({ celebrationOpen: false }),
}))
