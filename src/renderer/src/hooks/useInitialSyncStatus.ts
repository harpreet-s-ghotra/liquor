import { useEffect, useState } from 'react'
import type { InitialSyncStatus } from '../../../shared/types'

const IDLE_STATUS: InitialSyncStatus = {
  state: 'idle',
  currentEntity: null,
  progress: {},
  completed: [],
  errors: []
}

/**
 * Subscribes to initial sync status via IPC push events.
 * Falls back to polling the current status on mount.
 */
export function useInitialSyncStatus(): InitialSyncStatus {
  const [status, setStatus] = useState<InitialSyncStatus>(IDLE_STATUS)

  useEffect(() => {
    let cancelled = false

    // Fetch current status on mount
    window.api
      ?.getInitialSyncStatus()
      .then((s) => {
        if (!cancelled) setStatus(s)
      })
      .catch(() => {
        // Backend not ready yet — stay with idle
      })

    // Subscribe to push updates
    window.api?.onInitialSyncStatusChanged((s) => {
      if (!cancelled) setStatus(s)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return status
}
