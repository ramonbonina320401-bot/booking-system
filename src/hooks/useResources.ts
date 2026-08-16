import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { logAudit } from '@/lib/audit'
import type { NewResource, Resource } from '@/types/booking.types'

// ---------------------------------------------------------------------------
// TanStack Query hooks for resources (Firestore `resources/{id}`).
// ---------------------------------------------------------------------------

const resourcesKey = ['resources']

const resourcesCol = collection(db, 'resources')

function mapResource(docSnap: { id: string; data: () => unknown }): Resource {
  const d = docSnap.data() as Omit<Resource, 'id'>
  return {
    id: docSnap.id,
    name: d.name ?? '',
    description: d.description ?? null,
    is_active: d.is_active !== false,
    created_at: d.created_at ? String(d.created_at) : '',
  }
}

/** All resources (admin: include inactive; public: active only). */
export function useResources(opts: { includeInactive?: boolean } = {}) {
  const { includeInactive = false } = opts
  return useQuery({
    queryKey: [...resourcesKey, { includeInactive }],
    queryFn: async (): Promise<Resource[]> => {
      const snap = await getDocs(resourcesCol)
      const all = snap.docs.map(mapResource)
      return includeInactive ? all : all.filter((r) => r.is_active)
    },
  })
}

export function useCreateResource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (resource: NewResource) => {
      const ref = await addDoc(resourcesCol, {
        ...resource,
        created_at: Date.now(),
      })
      await logAudit({ action: 'resource_created', target_type: 'resource', target_id: ref.id, details: resource.name })
      return { id: ref.id, ...resource, created_at: String(Date.now()) } as Resource
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: resourcesKey }),
  })
}

export function useUpdateResource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<NewResource> & { id: string }) => {
      await updateDoc(doc(db, 'resources', id), patch)
      await logAudit({
        action: 'resource_updated',
        target_type: 'resource',
        target_id: id,
        details: Object.keys(patch).join(', '),
      })
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: resourcesKey }),
  })
}

export function useDeleteResource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      // Soft-delete by deactivating — keeps booking history intact.
      await setDoc(doc(db, 'resources', id), { is_active: false }, { merge: true })
      await logAudit({ action: 'resource_deleted', target_type: 'resource', target_id: id })
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: resourcesKey }),
  })
}
