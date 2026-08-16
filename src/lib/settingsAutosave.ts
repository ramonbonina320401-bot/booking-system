// ---------------------------------------------------------------------------
// settingsAutosave — module-level bridge between the SettingsPanel and the
// AdminLayout route watcher.
//
// The panel registers a `flush` function (its save) while mounted; the layout
// calls `flushDirtySettings()` on every route change. Because the registry is
// module-level (not React state), it still works after the panel unmounts.
// ---------------------------------------------------------------------------

type FlushFn = () => Promise<boolean>

let flushFn: FlushFn | null = null

export function registerSettingsFlusher(fn: FlushFn): void {
  flushFn = fn
}

/** Persist any dirty draft. Resolves true if there was nothing to save or the
 *  save succeeded; false if a save was attempted and failed. */
export async function flushDirtySettings(): Promise<boolean> {
  if (!flushFn) return true
  return flushFn()
}
