import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Booking flow store (Zustand) — multi-step form state.
// Step 1: pick a resource → Step 2: pick date + time slot → Step 3: confirm.
// ---------------------------------------------------------------------------

export type BookingStep = 'resource' | 'datetime' | 'review'

interface BookingFlowState {
  step: BookingStep
  resourceId: string | null
  date: Date | null
  startTime: string | null // ISO datetime of the slot start
  endTime: string | null // ISO datetime of the slot end
  notes: string
  // actions
  setStep: (step: BookingStep) => void
  setResourceId: (id: string) => void
  setDate: (date: Date) => void
  setSlot: (start: string, end: string) => void
  setNotes: (notes: string) => void
  reset: () => void
}

const initialState = {
  step: 'resource' as BookingStep,
  resourceId: null,
  date: null,
  startTime: null,
  endTime: null,
  notes: '',
}

export const useBookingFlowStore = create<BookingFlowState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setResourceId: (resourceId) => set({ resourceId }),
  setDate: (date) => set({ date }),
  setSlot: (startTime, endTime) => set({ startTime, endTime }),
  setNotes: (notes) => set({ notes }),
  reset: () => set({ ...initialState }),
}))
