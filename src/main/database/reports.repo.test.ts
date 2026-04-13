import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase, getDb } from './connection'
import { applySchema } from './schema'
import {
  getSalesSummary,
  getProductSales,
  getCategorySales,
  getTaxSummary,
  getComparisonData,
  getCashierSales,
  getHourlySales
} from './reports.repo'
import type { ReportDateRange } from '../../shared/types'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

function insertCashier(name: string): number {
  const result = getDb()
    .prepare(
      `INSERT INTO cashiers (name, pin_hash, role, is_active) VALUES (?, 'hash', 'cashier', 1)`
    )
    .run(name)
  return Number(result.lastInsertRowid)
}

function insertSession(cashierId: number, cashierName: string): number {
  const result = getDb()
    .prepare(
      `INSERT INTO sessions (opened_by_cashier_id, opened_by_cashier_name, status) VALUES (?, ?, 'active')`
    )
    .run(cashierId, cashierName)
  return Number(result.lastInsertRowid)
}

function insertProduct(
  sku: string,
  name: string,
  price: number = 10.0,
  cost: number = 5.0,
  taxRate: number = 0.08,
  itemType: string = 'Wine'
): number {
  const result = getDb()
    .prepare(
      `INSERT INTO products (sku, name, category, price, cost, quantity, tax_rate, tax_1, item_type) VALUES (?, ?, ?, ?, ?, 100, ?, ?, ?)`
    )
    .run(sku, name, itemType, price, cost, taxRate, taxRate, itemType)
  return Number(result.lastInsertRowid)
}

function insertTransaction(
  sessionId: number | null,
  paymentMethod: string,
  total: number,
  taxAmount: number,
  status: string = 'completed',
  createdAt: string = '2024-06-15 12:00:00'
): number {
  const txnNumber = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const result = getDb()
    .prepare(
      `INSERT INTO transactions (transaction_number, subtotal, tax_amount, total, payment_method, status, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      txnNumber,
      total - taxAmount,
      taxAmount,
      total,
      paymentMethod,
      status,
      sessionId,
      createdAt
    )
  return Number(result.lastInsertRowid)
}

function insertTransactionItem(
  transactionId: number,
  productId: number,
  quantity: number = 1,
  unitPrice: number = 10.0
): void {
  getDb()
    .prepare(
      `INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, 'Test Product', ?, ?, ?)`
    )
    .run(transactionId, productId, quantity, unitPrice, quantity * unitPrice)
}

// Date range covering June 2024
const juneRange: ReportDateRange = {
  from: '2024-06-01T00:00:00Z',
  to: '2024-06-30T23:59:59Z'
}

// Empty range (no transactions will match)
const emptyRange: ReportDateRange = {
  from: '2020-01-01T00:00:00Z',
  to: '2020-01-31T23:59:59Z'
}

describe('reports.repo', () => {
  beforeEach(() => {
    createTestDb()
  })

  describe('getSalesSummary', () => {
    it('returns zeros for empty range', () => {
      const report = getSalesSummary(emptyRange)
      expect(report.gross_sales).toBe(0)
      expect(report.net_sales).toBe(0)
      expect(report.tax_collected).toBe(0)
      expect(report.transaction_count).toBe(0)
      expect(report.avg_transaction).toBe(0)
      expect(report.refund_count).toBe(0)
      expect(report.refund_amount).toBe(0)
      expect(report.sales_by_payment).toEqual([])
      expect(report.sales_by_day).toEqual([])
    })

    it('computes totals for completed transactions', () => {
      const cashierId = insertCashier('Alice')
      const sessionId = insertSession(cashierId, 'Alice')
      const productId = insertProduct('SKU1', 'Wine A', 20.0, 10.0, 0.08)

      const txn1 = insertTransaction(
        sessionId,
        'cash',
        21.6,
        1.6,
        'completed',
        '2024-06-10 10:00:00'
      )
      insertTransactionItem(txn1, productId, 1, 20.0)

      const txn2 = insertTransaction(
        sessionId,
        'credit',
        43.2,
        3.2,
        'completed',
        '2024-06-10 14:00:00'
      )
      insertTransactionItem(txn2, productId, 2, 20.0)

      const report = getSalesSummary(juneRange)
      expect(report.transaction_count).toBe(2)
      expect(report.gross_sales).toBeCloseTo(64.8, 2)
      expect(report.tax_collected).toBeCloseTo(4.8, 2)
      expect(report.net_sales).toBeCloseTo(60.0, 2)
      expect(report.avg_transaction).toBeCloseTo(32.4, 2)
    })

    it('counts refunds separately', () => {
      insertTransaction(null, 'cash', 50.0, 4.0, 'completed', '2024-06-15 10:00:00')
      insertTransaction(null, 'cash', -25.0, -2.0, 'refund', '2024-06-15 12:00:00')

      const report = getSalesSummary(juneRange)
      expect(report.transaction_count).toBe(1)
      expect(report.gross_sales).toBe(50.0)
      expect(report.refund_count).toBe(1)
      expect(report.refund_amount).toBe(25.0)
    })

    it('groups sales by payment method', () => {
      insertTransaction(null, 'cash', 30.0, 2.0, 'completed', '2024-06-15 10:00:00')
      insertTransaction(null, 'credit', 50.0, 4.0, 'completed', '2024-06-15 11:00:00')
      insertTransaction(null, 'cash', 20.0, 1.5, 'completed', '2024-06-15 12:00:00')

      const report = getSalesSummary(juneRange)
      expect(report.sales_by_payment.length).toBe(2)
      const cash = report.sales_by_payment.find((r) => r.payment_method === 'cash')
      expect(cash?.transaction_count).toBe(2)
      expect(cash?.total_amount).toBe(50.0)
    })

    it('groups sales by day', () => {
      insertTransaction(null, 'cash', 30.0, 2.0, 'completed', '2024-06-10 10:00:00')
      insertTransaction(null, 'cash', 50.0, 4.0, 'completed', '2024-06-11 11:00:00')

      const report = getSalesSummary(juneRange)
      expect(report.sales_by_day.length).toBe(2)
      expect(report.sales_by_day[0].date).toBe('2024-06-10')
      expect(report.sales_by_day[1].date).toBe('2024-06-11')
    })
  })

  describe('getProductSales', () => {
    it('returns empty for empty range', () => {
      const report = getProductSales(emptyRange)
      expect(report.items).toEqual([])
    })

    it('aggregates product sales and computes profit/margin', () => {
      const p1 = insertProduct('SKU1', 'Wine A', 20.0, 8.0, 0.08, 'Wine')
      const p2 = insertProduct('SKU2', 'Vodka B', 30.0, 12.0, 0.08, 'Spirit')
      const txn = insertTransaction(null, 'cash', 80.0, 6.0, 'completed', '2024-06-15 10:00:00')
      insertTransactionItem(txn, p1, 2, 20.0)
      insertTransactionItem(txn, p2, 1, 30.0)

      const report = getProductSales(juneRange)
      expect(report.items.length).toBe(2)

      const wine = report.items.find((i) => i.sku === 'SKU1')!
      expect(wine.quantity_sold).toBe(2)
      expect(wine.revenue).toBe(40.0)
      expect(wine.cost_total).toBe(16.0) // 2 * 8
      expect(wine.profit).toBe(24.0)
      expect(wine.margin_pct).toBe(60.0)
    })

    it('respects limit parameter', () => {
      const p1 = insertProduct('SKU1', 'Wine A')
      const p2 = insertProduct('SKU2', 'Wine B')
      const txn = insertTransaction(null, 'cash', 20.0, 1.0, 'completed', '2024-06-15 10:00:00')
      insertTransactionItem(txn, p1, 1, 10.0)
      insertTransactionItem(txn, p2, 1, 10.0)

      const report = getProductSales(juneRange, 'revenue', 1)
      expect(report.items.length).toBe(1)
    })
  })

  describe('getCategorySales', () => {
    it('returns empty for empty range', () => {
      const report = getCategorySales(emptyRange)
      expect(report.categories).toEqual([])
    })

    it('groups sales by item type', () => {
      const p1 = insertProduct('SKU1', 'Wine A', 20.0, 8.0, 0.08, 'Wine')
      const p2 = insertProduct('SKU2', 'Vodka B', 30.0, 12.0, 0.08, 'Spirit')
      const txn = insertTransaction(null, 'cash', 80.0, 6.0, 'completed', '2024-06-15 10:00:00')
      insertTransactionItem(txn, p1, 2, 20.0)
      insertTransactionItem(txn, p2, 1, 30.0)

      const report = getCategorySales(juneRange)
      expect(report.categories.length).toBe(2)

      const wine = report.categories.find((c) => c.item_type === 'Wine')!
      expect(wine.revenue).toBe(40.0)
      expect(wine.quantity_sold).toBe(2)
    })
  })

  describe('getTaxSummary', () => {
    it('returns empty for empty range', () => {
      const report = getTaxSummary(emptyRange)
      expect(report.tax_rows).toEqual([])
    })

    it('groups tax by rate', () => {
      const p1 = insertProduct('SKU1', 'Wine A', 20.0, 8.0, 0.08, 'Wine')
      const p2 = insertProduct('SKU2', 'Non-Tax', 10.0, 5.0, 0, 'Beer')
      const txn = insertTransaction(null, 'cash', 32.0, 1.6, 'completed', '2024-06-15 10:00:00')
      insertTransactionItem(txn, p1, 1, 20.0)
      insertTransactionItem(txn, p2, 1, 10.0)

      const report = getTaxSummary(juneRange)
      expect(report.tax_rows.length).toBe(2)

      const taxed = report.tax_rows.find((r) => r.tax_rate > 0)!
      expect(taxed.taxable_sales).toBe(20.0)
      expect(taxed.tax_collected).toBeCloseTo(1.6, 1)
    })
  })

  describe('getComparisonData', () => {
    it('compares two periods', () => {
      insertTransaction(null, 'cash', 50.0, 4.0, 'completed', '2024-06-10 10:00:00')
      insertTransaction(null, 'cash', 80.0, 6.0, 'completed', '2024-07-10 10:00:00')

      const rangeA: ReportDateRange = {
        from: '2024-06-01T00:00:00Z',
        to: '2024-06-30T23:59:59Z'
      }
      const rangeB: ReportDateRange = {
        from: '2024-07-01T00:00:00Z',
        to: '2024-07-31T23:59:59Z'
      }

      const report = getComparisonData(rangeA, rangeB)
      expect(report.period_a.gross_sales).toBe(50.0)
      expect(report.period_b.gross_sales).toBe(80.0)

      const grossDelta = report.deltas.find((d) => d.field === 'Gross Sales')!
      expect(grossDelta.diff).toBe(30.0)
      expect(grossDelta.change_pct).toBe(60.0)
    })
  })

  describe('getCashierSales', () => {
    it('returns empty when no session-linked transactions exist', () => {
      insertTransaction(null, 'cash', 50.0, 4.0, 'completed', '2024-06-15 10:00:00')
      const report = getCashierSales(juneRange)
      expect(report.cashiers).toEqual([])
    })

    it('groups sales by cashier', () => {
      const cashier1 = insertCashier('Alice')
      const cashier2 = insertCashier('Bob')
      const session1 = insertSession(cashier1, 'Alice')
      const session2 = insertSession(cashier2, 'Bob')

      // Close session 1 first to allow a second active session scenario
      getDb().prepare(`UPDATE sessions SET status = 'closed' WHERE id = ?`).run(session1)

      insertTransaction(session1, 'cash', 50.0, 4.0, 'completed', '2024-06-10 10:00:00')
      insertTransaction(session1, 'cash', 30.0, 2.0, 'completed', '2024-06-10 11:00:00')
      insertTransaction(session2, 'credit', 100.0, 8.0, 'completed', '2024-06-15 10:00:00')

      const report = getCashierSales(juneRange)
      expect(report.cashiers.length).toBe(2)

      const alice = report.cashiers.find((c) => c.cashier_name === 'Alice')!
      expect(alice.transaction_count).toBe(2)
      expect(alice.gross_sales).toBe(80.0)
      expect(alice.avg_transaction).toBe(40.0)

      const bob = report.cashiers.find((c) => c.cashier_name === 'Bob')!
      expect(bob.transaction_count).toBe(1)
      expect(bob.gross_sales).toBe(100.0)
    })
  })

  describe('getHourlySales', () => {
    it('returns empty for empty range', () => {
      const report = getHourlySales(emptyRange)
      expect(report.hours).toEqual([])
    })

    it('groups transactions by hour', () => {
      insertTransaction(null, 'cash', 30.0, 2.0, 'completed', '2024-06-15 10:00:00')
      insertTransaction(null, 'cash', 50.0, 4.0, 'completed', '2024-06-15 10:30:00')
      insertTransaction(null, 'cash', 20.0, 1.5, 'completed', '2024-06-15 14:00:00')

      const report = getHourlySales(juneRange)
      expect(report.hours.length).toBe(2)

      const h10 = report.hours.find((h) => h.hour === 10)!
      expect(h10.transaction_count).toBe(2)
      expect(h10.gross_sales).toBe(80.0)

      const h14 = report.hours.find((h) => h.hour === 14)!
      expect(h14.transaction_count).toBe(1)
      expect(h14.gross_sales).toBe(20.0)
    })
  })
})
