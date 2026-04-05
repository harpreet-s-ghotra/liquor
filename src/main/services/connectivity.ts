/**
 * Connectivity monitoring service.
 *
 * Uses Electron's net.isOnline() as the primary check.
 * Polls periodically and notifies listeners when connectivity changes.
 */

import { net } from 'electron'

type ConnectivityListener = (online: boolean) => void

let currentOnline = true
let pollInterval: ReturnType<typeof setInterval> | null = null
const listeners: Set<ConnectivityListener> = new Set()

const POLL_INTERVAL_MS = 10_000

function checkAndNotify(): void {
  const online = net.isOnline()
  if (online !== currentOnline) {
    currentOnline = online
    for (const listener of listeners) {
      listener(online)
    }
  }
}

/**
 * Start polling for connectivity changes.
 */
export function startConnectivityMonitor(): void {
  currentOnline = net.isOnline()
  if (pollInterval) return
  pollInterval = setInterval(checkAndNotify, POLL_INTERVAL_MS)
}

/**
 * Stop polling.
 */
export function stopConnectivityMonitor(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

/**
 * Register a listener for connectivity changes. Returns an unsubscribe function.
 */
export function onConnectivityChange(listener: ConnectivityListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Get current online status.
 */
export function isOnline(): boolean {
  return currentOnline
}
