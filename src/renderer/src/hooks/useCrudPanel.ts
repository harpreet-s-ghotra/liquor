import { useCallback, useEffect, useState } from 'react'

/**
 * Generic hook for CRUD panel state management.
 * Handles items loading, error/success messaging, editing ID tracking,
 * and wraps async API calls with consistent error handling.
 *
 * `loadFn` should have a stable identity (e.g. wrapped in `useCallback`)
 * to avoid unnecessary re-creation of `runAction` and `loadItems`.
 */

type UseCrudPanelOptions<T> = {
  /** Name used in default error messages, e.g. "department" → "Unable to load departments" */
  entityName: string
  /** Function to load items from the backend; undefined when API is unavailable */
  loadFn: (() => Promise<T[]>) | undefined
}

type UseCrudPanelReturn<T> = {
  items: T[]
  error: string | null
  success: string | null
  showValidation: boolean
  editingId: number | null
  setShowValidation: (value: boolean) => void
  setEditingId: (id: number | null) => void
  setError: (msg: string | null) => void
  setSuccess: (msg: string | null) => void
  clearMessages: () => void
  /**
   * Run an async CRUD call (create / update / delete) with automatic
   * error handling and item reload on success.
   * Returns the freshly reloaded items on success, or `null` on failure.
   */
  runAction: (fn: () => Promise<unknown>, successMsg: string) => Promise<T[] | null>
  /** Reload items from the backend. Returns the fresh items array. */
  loadItems: () => Promise<T[]>
}

export function useCrudPanel<T>(options: UseCrudPanelOptions<T>): UseCrudPanelReturn<T> {
  const { entityName, loadFn } = options

  const [items, setItems] = useState<T[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const clearMessages = useCallback((): void => {
    setError(null)
    setSuccess(null)
  }, [])

  /**
   * Fetch items from the backend via loadFn and update state.
   * Returns the fresh array (empty on failure or when loadFn is unavailable).
   */
  const loadItems = useCallback(async (): Promise<T[]> => {
    if (!loadFn) return []
    try {
      const data = await loadFn()
      setItems(data)
      return data
    } catch {
      setError(`Unable to load ${entityName}s`)
      return []
    }
  }, [loadFn, entityName])

  // Initial load on mount (or if loadFn identity changes)
  useEffect(() => {
    if (!loadFn) return
    let stale = false
    loadFn()
      .then((data) => {
        if (!stale) setItems(data)
      })
      .catch(() => {
        if (!stale) setError(`Unable to load ${entityName}s`)
      })
    return (): void => {
      stale = true
    }
  }, [loadFn, entityName])

  /**
   * Run an async CRUD call with automatic error handling and item reload.
   * Calls `loadFn` directly (not via `loadItems`) to avoid any
   * closure-chain indirection. Returns fresh items or null on failure.
   */
  const runAction = useCallback(
    async (fn: () => Promise<unknown>, successMsg: string): Promise<T[] | null> => {
      clearMessages()
      try {
        await fn()
        // Call loadFn directly — same function, no intermediate wrapper
        let freshItems: T[] = []
        if (loadFn) {
          freshItems = await loadFn()
          setItems(freshItems)
        }
        setSuccess(successMsg)
        return freshItems
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${successMsg.toLowerCase()}`)
        return null
      }
    },
    [clearMessages, loadFn]
  )

  return {
    items,
    error,
    success,
    showValidation,
    editingId,
    setShowValidation,
    setEditingId,
    setError,
    setSuccess,
    clearMessages,
    runAction,
    loadItems
  }
}
