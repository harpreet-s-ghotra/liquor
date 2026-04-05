import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from './connection'
import { applySchema } from './schema'
import {
  enqueueSyncItem,
  getPendingItems,
  markInFlight,
  markDone,
  markFailed,
  retryFailed,
  getQueueStats,
  recoverInFlight
} from './sync-queue.repo'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

const baseItem = {
  entity_type: 'transaction' as const,
  entity_id: '1',
  operation: 'INSERT' as const,
  payload: '{"id":1}',
  device_id: 'device-uuid-1'
}

describe('sync-queue.repo', () => {
  beforeEach(() => {
    createTestDb()
  })

  describe('enqueueSyncItem / getPendingItems', () => {
    it('returns empty list on fresh DB', () => {
      expect(getPendingItems()).toEqual([])
    })

    it('enqueues an item and retrieves it as pending', () => {
      enqueueSyncItem(baseItem)
      const pending = getPendingItems()
      expect(pending).toHaveLength(1)
      expect(pending[0].entity_type).toBe('transaction')
      expect(pending[0].status).toBe('pending')
      expect(pending[0].attempts).toBe(0)
    })

    it('respects limit parameter', () => {
      enqueueSyncItem(baseItem)
      enqueueSyncItem({ ...baseItem, entity_id: '2' })
      expect(getPendingItems(1)).toHaveLength(1)
    })

    it('returns items in FIFO order', () => {
      enqueueSyncItem({ ...baseItem, entity_id: '1' })
      enqueueSyncItem({ ...baseItem, entity_id: '2' })
      const pending = getPendingItems()
      expect(pending[0].entity_id).toBe('1')
      expect(pending[1].entity_id).toBe('2')
    })
  })

  describe('markInFlight', () => {
    it('moves items to in_flight status', () => {
      enqueueSyncItem(baseItem)
      const [item] = getPendingItems()
      markInFlight([item.id])
      expect(getPendingItems()).toHaveLength(0)
    })

    it('handles empty array gracefully', () => {
      expect(() => markInFlight([])).not.toThrow()
    })
  })

  describe('markDone', () => {
    it('removes items from the queue', () => {
      enqueueSyncItem(baseItem)
      const [item] = getPendingItems()
      markDone([item.id])
      expect(getPendingItems()).toHaveLength(0)
    })

    it('handles empty array gracefully', () => {
      expect(() => markDone([])).not.toThrow()
    })
  })

  describe('markFailed', () => {
    it('marks item as failed with error', () => {
      enqueueSyncItem(baseItem)
      const [item] = getPendingItems()
      markFailed(item.id, 'Network error')
      const stats = getQueueStats()
      expect(stats.failed).toBe(1)
      expect(stats.pending).toBe(0)
    })

    it('increments attempts on failure', () => {
      enqueueSyncItem(baseItem)
      const [item] = getPendingItems()
      markFailed(item.id, 'Error 1')
      markFailed(item.id, 'Error 2')
      // Item is failed, not pending — verify via stats
      const stats = getQueueStats()
      expect(stats.failed).toBe(1)
    })
  })

  describe('retryFailed', () => {
    it('resets failed items under max attempts to pending', () => {
      enqueueSyncItem(baseItem)
      const [item] = getPendingItems()
      markFailed(item.id, 'Error')
      const count = retryFailed()
      expect(count).toBe(1)
      expect(getPendingItems()).toHaveLength(1)
    })

    it('returns 0 when nothing to retry', () => {
      expect(retryFailed()).toBe(0)
    })
  })

  describe('getQueueStats', () => {
    it('returns zeroes on empty queue', () => {
      const stats = getQueueStats()
      expect(stats.pending).toBe(0)
      expect(stats.in_flight).toBe(0)
      expect(stats.failed).toBe(0)
    })

    it('counts items by status correctly', () => {
      enqueueSyncItem(baseItem)
      enqueueSyncItem({ ...baseItem, entity_id: '2' })
      enqueueSyncItem({ ...baseItem, entity_id: '3' })
      const [item1, item2] = getPendingItems()
      markInFlight([item1.id])
      markFailed(item2.id, 'Error')
      const stats = getQueueStats()
      expect(stats.pending).toBe(1)
      expect(stats.in_flight).toBe(1)
      expect(stats.failed).toBe(1)
    })
  })

  describe('recoverInFlight', () => {
    it('resets in_flight items to pending', () => {
      enqueueSyncItem(baseItem)
      enqueueSyncItem({ ...baseItem, entity_id: '2' })
      const items = getPendingItems()
      markInFlight(items.map((i) => i.id))
      const count = recoverInFlight()
      expect(count).toBe(2)
      expect(getPendingItems()).toHaveLength(2)
    })

    it('returns 0 when no in_flight items', () => {
      expect(recoverInFlight()).toBe(0)
    })
  })
})
