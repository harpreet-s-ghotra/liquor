import { useCallback, useEffect, useState } from 'react'

/**
 * Generic hook for CRUD panel state management.
 * Handles items loading, error/success messaging, editing ID tracking,
 * and wraps async API calls with consistent error handling.
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
  clearMessages: () => void
  /**
   * Run an async CRUD call (create / update / delete) with automatic
   * error handling and item reload on success.
   */
  runAction: (fn: () => Promise<unknown>, successMsg: string) => Promise<boolean>
  /** Reload items from the backend */
  loadItems: () => Promise<void>
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

  const loadItems = useCallback(async (): Promise<void> => {
    if (!loadFn) return
    try {
      const data = await loadFn()
      setItems(data)
    } catch {
      setError(`Unable to load ${entityName}s`)
    }
  }, [loadFn, entityName])

  // Initial load with stale-closure guard
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

  const runAction = useCallback(
    async (fn: () => Promise<unknown>, successMsg: string): Promise<boolean> => {
      clearMessages()
      try {
        await fn()
        setSuccess(successMsg)
        await loadItems()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${successMsg.toLowerCase()}`)
        return false
      }
    },
    [clearMessages, loadItems]
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
    clearMessages,
    runAction,
    loadItems
  }
}
