import { QueryClient } from '@tanstack/react-query'

/**
 * Global TanStack Query client.
 * - `retry: 1` keeps failed network calls snappy on flaky mobile networks.
 * - Settings use `staleTime: Infinity` because they are fetched once and
 *   cached; the admin panel invalidates the query after saving.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
})
