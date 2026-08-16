import { AppRouter } from '@/routes/AppRouter'

/**
 * Root component. The router lives in AppRouter so all routing / guards
 * (auth, admin, maintenance) are defined in one place.
 */
export default function App() {
  return <AppRouter />
}
