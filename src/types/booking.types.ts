export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

/** Mirrors the `bookings` table. */
export interface Booking {
  id: string
  user_id: string
  resource_id: string
  start_time: string
  end_time: string
  status: BookingStatus
  notes: string | null
  created_at: string
  // joined from FK — optional in the raw row, filled by select queries
  resource?: Resource | null
  user?: { full_name: string | null; email?: string; phone?: string | null } | null
}

export interface NewBooking {
  resource_id: string
  start_time: string
  end_time: string
  notes?: string | null
}

/** Mirrors the `resources` table. */
export interface Resource {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export type NewResource = Pick<Resource, 'name' | 'description' | 'is_active'>
