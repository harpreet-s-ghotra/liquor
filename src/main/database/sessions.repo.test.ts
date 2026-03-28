import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase, getDb } from './connection'
import { applySchema } from './schema'
import {
  createSession,
  getActiveSession,
  closeSession,
  listSessions,
  generateClockOutReport
} from './sessions.repo'
import type { CreateSessionInput } from '../../shared/types'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

/**
 * Helper to insert a cashier into the test database.
 */
function insertCashier(name: string, pinHash: string = 'hashed-pin'): number {
  const result = getDb()
    .prepare(`INSERT INTO cashiers (name, pin_hash, role, is_active) VALUES (?, ?, 'cashier', 1)`)
    .run(name, pinHash)
  return Number(result.lastInsertRowid)
}

/**
 * Helper to insert a department into the test database.
 */
function insertDepartment(name: string): number {
  const result = getDb().prepare(`INSERT INTO departments (name) VALUES (?)`).run(name)
  return Number(result.lastInsertRowid)
}

/**
 * Helper to insert a product into the test database.
 */
function insertProduct(
  sku: string,
  name: string,
  deptId?: number,
  price: number = 10.0,
  taxRate: number = 0.08
): number {
  const result = getDb()
    .prepare(
      `
      INSERT INTO products (sku, name, category, price, quantity, barcode, tax_rate, dept_id)
      VALUES (?, ?, 'Spirits', ?, 100, '123456', ?, ?)
    `
    )
    .run(sku, name, price, taxRate, deptId ? String(deptId) : null)
  return Number(result.lastInsertRowid)
}

/**
 * Helper to insert a transaction into the test database.
 */
function insertTransaction(
  sessionId: number,
  paymentMethod: string = 'cash',
  total: number = 10.0,
  taxAmount: number = 0.8,
  status: string = 'completed'
): number {
  const txnNumber = `TXN-${Date.now()}-${Math.random()}`
  const subtotal = total - taxAmount
  const result = getDb()
    .prepare(
      `
      INSERT INTO transactions
      (transaction_number, subtotal, tax_amount, total, payment_method, status, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(txnNumber, subtotal, taxAmount, total, paymentMethod, status, sessionId)
  return Number(result.lastInsertRowid)
}

/**
 * Helper to insert a transaction item into the test database.
 */
function insertTransactionItem(
  transactionId: number,
  productId: number,
  quantity: number = 1,
  unitPrice: number = 10.0
): void {
  const totalPrice = quantity * unitPrice
  getDb()
    .prepare(
      `
      INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, total_price)
      VALUES (?, ?, 'Test Product', ?, ?, ?)
    `
    )
    .run(transactionId, productId, quantity, unitPrice, totalPrice)
}

describe('sessions.repo', () => {
  beforeEach(() => {
    createTestDb()
  })

  // ────────────────────────────────────────────────────────────────────────────
  // createSession
  // ────────────────────────────────────────────────────────────────────────────

  describe('createSession', () => {
    it('creates a session with status active', () => {
      const cashierId = insertCashier('Alice')
      const input: CreateSessionInput = { cashier_id: cashierId, cashier_name: 'Alice' }

      const session = createSession(input)

      expect(session.id).toBeGreaterThan(0)
      expect(session.opened_by_cashier_id).toBe(cashierId)
      expect(session.opened_by_cashier_name).toBe('Alice')
      expect(session.status).toBe('active')
      expect(session.closed_by_cashier_id).toBeNull()
      expect(session.closed_by_cashier_name).toBeNull()
      expect(session.ended_at).toBeNull()
      expect(session.started_at).toBeTruthy()
      expect(session.started_at).toContain('T')
      expect(session.started_at).toContain('Z')
    })

    it('returns the created session with correct fields', () => {
      const cashierId = insertCashier('Bob')
      const input: CreateSessionInput = { cashier_id: cashierId, cashier_name: 'Bob' }

      const session = createSession(input)

      // Re-fetch from DB to verify persistence
      const fetched = getDb()
        .prepare('SELECT * FROM sessions WHERE id = ?')
        .get(session.id) as typeof session
      expect(fetched.id).toBe(session.id)
      expect(fetched.opened_by_cashier_id).toBe(cashierId)
      expect(fetched.opened_by_cashier_name).toBe('Bob')
      expect(fetched.status).toBe('active')
    })

    it('throws if an active session already exists', () => {
      const cashierId1 = insertCashier('Alice')
      const cashierId2 = insertCashier('Bob')

      createSession({ cashier_id: cashierId1, cashier_name: 'Alice' })

      expect(() => {
        createSession({ cashier_id: cashierId2, cashier_name: 'Bob' })
      }).toThrow('An active session already exists')
    })

    it('allows creating a new session after the previous one is closed', () => {
      const cashierId1 = insertCashier('Alice')
      const cashierId2 = insertCashier('Bob')

      const session1 = createSession({ cashier_id: cashierId1, cashier_name: 'Alice' })
      closeSession({ session_id: session1.id, cashier_id: cashierId1, cashier_name: 'Alice' })

      const session2 = createSession({ cashier_id: cashierId2, cashier_name: 'Bob' })
      expect(session2.id).not.toBe(session1.id)
      expect(session2.status).toBe('active')
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // getActiveSession
  // ────────────────────────────────────────────────────────────────────────────

  describe('getActiveSession', () => {
    it('returns null when no sessions exist', () => {
      const session = getActiveSession()
      expect(session).toBeNull()
    })

    it('returns the active session', () => {
      const cashierId = insertCashier('Alice')
      const created = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })

      const retrieved = getActiveSession()

      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.opened_by_cashier_id).toBe(cashierId)
      expect(retrieved?.status).toBe('active')
    })

    it('returns null when all sessions are closed', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })
      closeSession({ session_id: session.id, cashier_id: cashierId, cashier_name: 'Alice' })

      const active = getActiveSession()

      expect(active).toBeNull()
    })

    it('returns the most recent active session when multiple closed sessions exist', () => {
      const cashierId1 = insertCashier('Alice')
      const cashierId2 = insertCashier('Bob')
      const cashierId3 = insertCashier('Carol')

      // Create, close, create cycle
      const session1 = createSession({ cashier_id: cashierId1, cashier_name: 'Alice' })
      closeSession({ session_id: session1.id, cashier_id: cashierId1, cashier_name: 'Alice' })

      const session2 = createSession({ cashier_id: cashierId2, cashier_name: 'Bob' })
      closeSession({ session_id: session2.id, cashier_id: cashierId2, cashier_name: 'Bob' })

      const session3 = createSession({ cashier_id: cashierId3, cashier_name: 'Carol' })

      const active = getActiveSession()

      expect(active?.id).toBe(session3.id)
      expect(active?.opened_by_cashier_id).toBe(cashierId3)
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // closeSession
  // ────────────────────────────────────────────────────────────────────────────

  describe('closeSession', () => {
    it('closes an active session and sets ended_at and closed_by fields', () => {
      const cashierId1 = insertCashier('Alice')
      const cashierId2 = insertCashier('Bob')
      const session = createSession({ cashier_id: cashierId1, cashier_name: 'Alice' })

      const closed = closeSession({
        session_id: session.id,
        cashier_id: cashierId2,
        cashier_name: 'Bob'
      })

      expect(closed.id).toBe(session.id)
      expect(closed.status).toBe('closed')
      expect(closed.closed_by_cashier_id).toBe(cashierId2)
      expect(closed.closed_by_cashier_name).toBe('Bob')
      expect(closed.ended_at).toBeTruthy()
    })

    it('throws on non-existent session', () => {
      const cashierId = insertCashier('Alice')

      expect(() => {
        closeSession({
          session_id: 99999,
          cashier_id: cashierId,
          cashier_name: 'Alice'
        })
      }).toThrow('Session not found')
    })

    it('throws on already-closed session', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })
      closeSession({ session_id: session.id, cashier_id: cashierId, cashier_name: 'Alice' })

      expect(() => {
        closeSession({
          session_id: session.id,
          cashier_id: cashierId,
          cashier_name: 'Alice'
        })
      }).toThrow('Session is already closed')
    })

    it('sets ended_at to a timestamp value', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })

      const closed = closeSession({
        session_id: session.id,
        cashier_id: cashierId,
        cashier_name: 'Alice'
      })

      expect(closed.ended_at).not.toBeNull()
      expect(typeof closed.ended_at).toBe('string')
      // Verify it's a valid UTC ISO datetime string with T and Z
      expect(closed.ended_at).toContain('T')
      expect(closed.ended_at).toContain('Z')
      const endedAt = new Date(closed.ended_at!)
      expect(endedAt.getTime()).toBeGreaterThan(0)
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // listSessions
  // ────────────────────────────────────────────────────────────────────────────

  describe('listSessions', () => {
    it('returns empty list when no sessions exist', () => {
      const result = listSessions(10, 0)

      expect(result.sessions).toEqual([])
      expect(result.total_count).toBe(0)
    })

    it('returns sessions ordered by started_at DESC (most recent first)', () => {
      const cashierId1 = insertCashier('Alice')
      const cashierId2 = insertCashier('Bob')
      const cashierId3 = insertCashier('Carol')

      const session1 = createSession({ cashier_id: cashierId1, cashier_name: 'Alice' })
      closeSession({ session_id: session1.id, cashier_id: cashierId1, cashier_name: 'Alice' })

      // Add a small delay to ensure different timestamps
      const session2 = createSession({ cashier_id: cashierId2, cashier_name: 'Bob' })
      closeSession({ session_id: session2.id, cashier_id: cashierId2, cashier_name: 'Bob' })

      const session3 = createSession({ cashier_id: cashierId3, cashier_name: 'Carol' })

      const result = listSessions(10, 0)

      expect(result.sessions.length).toBe(3)
      // Session 3 should be first (most recent), then 2, then 1
      expect(result.sessions[0].id).toBe(session3.id)
      expect(result.sessions[1].id).toBe(session2.id)
      expect(result.sessions[2].id).toBe(session1.id)
    })

    it('respects limit parameter', () => {
      const cashierId1 = insertCashier('Alice')
      const cashierId2 = insertCashier('Bob')
      const cashierId3 = insertCashier('Carol')

      createSession({ cashier_id: cashierId1, cashier_name: 'Alice' })
      closeSession({
        session_id: getActiveSession()!.id,
        cashier_id: cashierId1,
        cashier_name: 'Alice'
      })

      createSession({ cashier_id: cashierId2, cashier_name: 'Bob' })
      closeSession({
        session_id: getActiveSession()!.id,
        cashier_id: cashierId2,
        cashier_name: 'Bob'
      })

      createSession({ cashier_id: cashierId3, cashier_name: 'Carol' })

      const result = listSessions(2, 0)

      expect(result.sessions.length).toBe(2)
      expect(result.total_count).toBe(3)
    })

    it('respects offset parameter', () => {
      const cashierIds = [insertCashier('Alice'), insertCashier('Bob'), insertCashier('Carol')]

      cashierIds.forEach((id, idx) => {
        const session = createSession({
          cashier_id: id,
          cashier_name: ['Alice', 'Bob', 'Carol'][idx]!
        })
        if (idx < 2) {
          closeSession({
            session_id: session.id,
            cashier_id: id,
            cashier_name: ['Alice', 'Bob', 'Carol'][idx]!
          })
        }
      })

      const resultPage1 = listSessions(2, 0)
      const resultPage2 = listSessions(2, 2)

      expect(resultPage1.sessions.length).toBe(2)
      expect(resultPage2.sessions.length).toBe(1)
    })

    it('returns correct total_count', () => {
      const cashierIds = [insertCashier('Alice'), insertCashier('Bob'), insertCashier('Carol')]

      cashierIds.forEach((id, idx) => {
        const session = createSession({
          cashier_id: id,
          cashier_name: ['Alice', 'Bob', 'Carol'][idx]!
        })
        if (idx < 2) {
          closeSession({
            session_id: session.id,
            cashier_id: id,
            cashier_name: ['Alice', 'Bob', 'Carol'][idx]!
          })
        }
      })

      const result1 = listSessions(1, 0)
      const result2 = listSessions(10, 0)

      expect(result1.total_count).toBe(3)
      expect(result2.total_count).toBe(3)
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // generateClockOutReport
  // ────────────────────────────────────────────────────────────────────────────

  describe('generateClockOutReport', () => {
    it('throws on non-existent session', () => {
      expect(() => {
        generateClockOutReport(99999)
      }).toThrow('Session not found')
    })

    it('returns correct structure with all required fields', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })

      const report = generateClockOutReport(session.id)

      expect(report).toHaveProperty('session')
      expect(report).toHaveProperty('sales_by_department')
      expect(report).toHaveProperty('sales_by_payment_method')
      expect(report).toHaveProperty('total_sales_count')
      expect(report).toHaveProperty('gross_sales')
      expect(report).toHaveProperty('total_tax_collected')
      expect(report).toHaveProperty('net_sales')
      expect(report).toHaveProperty('total_refund_count')
      expect(report).toHaveProperty('total_refund_amount')
      expect(report).toHaveProperty('average_transaction_value')
      expect(report).toHaveProperty('expected_cash_at_close')
      expect(report).toHaveProperty('cash_total')
      expect(report).toHaveProperty('credit_total')
      expect(report).toHaveProperty('debit_total')
    })

    it('handles session with no transactions (all zeros)', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })

      const report = generateClockOutReport(session.id)

      expect(report.total_sales_count).toBe(0)
      expect(report.gross_sales).toBe(0)
      expect(report.total_tax_collected).toBe(0)
      expect(report.net_sales).toBe(0)
      expect(report.total_refund_count).toBe(0)
      expect(report.total_refund_amount).toBe(0)
      expect(report.average_transaction_value).toBe(0)
      expect(report.expected_cash_at_close).toBe(0)
      expect(report.cash_total).toBe(0)
      expect(report.credit_total).toBe(0)
      expect(report.debit_total).toBe(0)
      expect(report.sales_by_department).toEqual([])
      expect(report.sales_by_payment_method).toEqual([])
    })

    it('calculates correct totals (gross, tax, net) from completed transactions', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })
      const productId = insertProduct('WINE-001', 'Test Wine', undefined, 10.0, 0.08)

      // Transaction 1: $10.00 total, $0.80 tax, $9.20 subtotal
      const txn1 = insertTransaction(session.id, 'cash', 10.0, 0.8, 'completed')
      insertTransactionItem(txn1, productId, 1, 10.0)

      // Transaction 2: $20.00 total, $1.60 tax, $18.40 subtotal
      const txn2 = insertTransaction(session.id, 'credit', 20.0, 1.6, 'completed')
      insertTransactionItem(txn2, productId, 2, 10.0)

      const report = generateClockOutReport(session.id)

      expect(report.total_sales_count).toBe(2)
      expect(report.gross_sales).toBeCloseTo(30.0) // 10.0 + 20.0
      expect(report.total_tax_collected).toBeCloseTo(2.4) // 0.8 + 1.6
      expect(report.net_sales).toBeCloseTo(27.6) // 30.0 - 2.4
      expect(report.average_transaction_value).toBeCloseTo(15.0) // 30.0 / 2
    })

    it('returns correct department breakdown', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })

      const deptId1 = insertDepartment('Spirits')
      const deptId2 = insertDepartment('Wine')

      const productId1 = insertProduct('SPIRITS-001', 'Vodka', deptId1, 20.0, 0.08)
      const productId2 = insertProduct('WINE-001', 'Red Wine', deptId2, 15.0, 0.08)

      // Transaction in Spirits: $20.00
      const txn1 = insertTransaction(session.id, 'cash', 20.0, 1.6, 'completed')
      insertTransactionItem(txn1, productId1, 1, 20.0)

      // Transaction in Wine: $15.00
      const txn2 = insertTransaction(session.id, 'cash', 15.0, 1.2, 'completed')
      insertTransactionItem(txn2, productId2, 1, 15.0)

      // Transaction in Wine: $15.00 (2 items)
      const txn3 = insertTransaction(session.id, 'cash', 30.0, 2.4, 'completed')
      insertTransactionItem(txn3, productId2, 2, 15.0)

      const report = generateClockOutReport(session.id)

      expect(report.sales_by_department.length).toBe(2)

      // Wine should be first (highest total)
      const wine = report.sales_by_department.find((d) => d.department_name === 'Wine')
      const spirits = report.sales_by_department.find((d) => d.department_name === 'Spirits')

      expect(wine).toEqual({ department_name: 'Wine', transaction_count: 2, total_amount: 45.0 })
      expect(spirits).toEqual({
        department_name: 'Spirits',
        transaction_count: 1,
        total_amount: 20.0
      })
    })

    it('returns correct payment method breakdown', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })
      const productId = insertProduct('WINE-001', 'Wine', undefined, 10.0, 0.08)

      // Cash transactions
      const txn1 = insertTransaction(session.id, 'cash', 10.0, 0.8, 'completed')
      insertTransactionItem(txn1, productId, 1, 10.0)

      const txn2 = insertTransaction(session.id, 'cash', 10.0, 0.8, 'completed')
      insertTransactionItem(txn2, productId, 1, 10.0)

      // Credit transactions
      const txn3 = insertTransaction(session.id, 'credit', 20.0, 1.6, 'completed')
      insertTransactionItem(txn3, productId, 2, 10.0)

      // Debit transaction
      const txn4 = insertTransaction(session.id, 'debit', 30.0, 2.4, 'completed')
      insertTransactionItem(txn4, productId, 3, 10.0)

      const report = generateClockOutReport(session.id)

      expect(report.sales_by_payment_method.length).toBe(3)
      expect(report.sales_by_payment_method).toContainEqual({
        payment_method: 'debit',
        transaction_count: 1,
        total_amount: 30.0
      })
      expect(report.sales_by_payment_method).toContainEqual({
        payment_method: 'credit',
        transaction_count: 1,
        total_amount: 20.0
      })
      expect(report.sales_by_payment_method).toContainEqual({
        payment_method: 'cash',
        transaction_count: 2,
        total_amount: 20.0
      })
    })

    it('calculates correct refund totals', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })
      const productId = insertProduct('WINE-001', 'Wine', undefined, 10.0, 0.08)

      // Completed transaction
      const txn1 = insertTransaction(session.id, 'cash', 10.0, 0.8, 'completed')
      insertTransactionItem(txn1, productId, 1, 10.0)

      // Refund 1: $5.00
      const refund1 = insertTransaction(session.id, 'cash', -5.0, -0.4, 'refund')
      insertTransactionItem(refund1, productId, -0.5, 10.0)

      // Refund 2: $3.00
      const refund2 = insertTransaction(session.id, 'cash', -3.0, -0.24, 'refund')
      insertTransactionItem(refund2, productId, -0.3, 10.0)

      const report = generateClockOutReport(session.id)

      expect(report.total_refund_count).toBe(2)
      expect(report.total_refund_amount).toBeCloseTo(8.0) // 5.0 + 3.0
    })

    it('calculates correct expected cash at close', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })
      const productId = insertProduct('WINE-001', 'Wine', undefined, 10.0, 0.08)

      // Cash sales: $50.00
      const txn1 = insertTransaction(session.id, 'cash', 25.0, 2.0, 'completed')
      insertTransactionItem(txn1, productId, 2.5, 10.0)

      const txn2 = insertTransaction(session.id, 'cash', 25.0, 2.0, 'completed')
      insertTransactionItem(txn2, productId, 2.5, 10.0)

      // Cash refund: $10.00
      const refund = insertTransaction(session.id, 'cash', -10.0, -0.8, 'refund')
      insertTransactionItem(refund, productId, -1.0, 10.0)

      // Credit sale: $30.00 (should not affect expected cash)
      const txn3 = insertTransaction(session.id, 'credit', 30.0, 2.4, 'completed')
      insertTransactionItem(txn3, productId, 3.0, 10.0)

      const report = generateClockOutReport(session.id)

      // Expected cash = cash_sales - cash_refunds = 50.0 - 10.0 = 40.0
      expect(report.expected_cash_at_close).toBeCloseTo(40.0)
      expect(report.cash_total).toBeCloseTo(50.0)
      expect(report.credit_total).toBeCloseTo(30.0)
    })

    it('separates payment methods correctly in report', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })
      const productId = insertProduct('WINE-001', 'Wine', undefined, 10.0, 0.08)

      // Cash sales: $40.00
      const cashTxn0 = insertTransaction(session.id, 'cash', 20.0, 1.6, 'completed')
      insertTransactionItem(cashTxn0, productId, 2, 10.0)

      // Create more transactions with explicit handling
      const cashTxn1 = insertTransaction(session.id, 'cash', 20.0, 1.6, 'completed')
      insertTransactionItem(cashTxn1, productId, 2, 10.0)

      // Credit sales: $30.00
      const creditTxn = insertTransaction(session.id, 'credit', 30.0, 2.4, 'completed')
      insertTransactionItem(creditTxn, productId, 3, 10.0)

      // Debit sales: $10.00
      const debitTxn = insertTransaction(session.id, 'debit', 10.0, 0.8, 'completed')
      insertTransactionItem(debitTxn, productId, 1, 10.0)

      // Cash refund: $5.00
      const refund = insertTransaction(session.id, 'cash', -5.0, -0.4, 'refund')
      insertTransactionItem(refund, productId, -0.5, 10.0)

      const report = generateClockOutReport(session.id)

      expect(report.cash_total).toBeCloseTo(40.0)
      expect(report.credit_total).toBeCloseTo(30.0)
      expect(report.debit_total).toBeCloseTo(10.0)
    })

    it('ignores non-completed transactions in sales totals', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })
      const productId = insertProduct('WINE-001', 'Wine', undefined, 10.0, 0.08)

      // Completed transaction
      const txn1 = insertTransaction(session.id, 'cash', 10.0, 0.8, 'completed')
      insertTransactionItem(txn1, productId, 1, 10.0)

      // Refund (should not be counted in sales totals, only in refund totals)
      const refund = insertTransaction(session.id, 'cash', -5.0, -0.4, 'refund')
      insertTransactionItem(refund, productId, -0.5, 10.0)

      const report = generateClockOutReport(session.id)

      // Sales should only include completed transactions
      expect(report.total_sales_count).toBe(1)
      expect(report.gross_sales).toBe(10.0)
      expect(report.total_refund_count).toBe(1)
    })

    it('calculates average transaction value correctly', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })
      const productId = insertProduct('WINE-001', 'Wine', undefined, 10.0, 0.08)

      // Three transactions: $10, $20, $30
      const txn1 = insertTransaction(session.id, 'cash', 10.0, 0.8, 'completed')
      insertTransactionItem(txn1, productId, 1, 10.0)

      const txn2 = insertTransaction(session.id, 'cash', 20.0, 1.6, 'completed')
      insertTransactionItem(txn2, productId, 2, 10.0)

      const txn3 = insertTransaction(session.id, 'cash', 30.0, 2.4, 'completed')
      insertTransactionItem(txn3, productId, 3, 10.0)

      const report = generateClockOutReport(session.id)

      // Average: 60.0 / 3 = 20.0
      expect(report.average_transaction_value).toBeCloseTo(20.0)
    })

    it('includes the session data in the report', () => {
      const cashierId = insertCashier('Alice')
      const createdSession = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })

      const report = generateClockOutReport(createdSession.id)

      expect(report.session.id).toBe(createdSession.id)
      expect(report.session.opened_by_cashier_id).toBe(cashierId)
      expect(report.session.opened_by_cashier_name).toBe('Alice')
    })

    it('handles multiple products in single transaction correctly', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })

      const deptId = insertDepartment('Spirits')
      const productId1 = insertProduct('SPIRITS-001', 'Vodka', deptId, 20.0, 0.08)
      const productId2 = insertProduct('SPIRITS-002', 'Rum', deptId, 15.0, 0.08)

      // Single transaction with multiple items
      const txn = insertTransaction(session.id, 'cash', 35.0, 2.8, 'completed')
      insertTransactionItem(txn, productId1, 1, 20.0)
      insertTransactionItem(txn, productId2, 1, 15.0)

      const report = generateClockOutReport(session.id)

      expect(report.total_sales_count).toBe(1)
      expect(report.gross_sales).toBe(35.0)
      expect(report.sales_by_department[0].transaction_count).toBe(1)
      expect(report.sales_by_department[0].total_amount).toBe(35.0)
    })

    it('handles products without department (null dept_id)', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })

      const productId = insertProduct('NO-DEPT-001', 'Unclassified Item', undefined, 10.0, 0.08)

      const txn = insertTransaction(session.id, 'cash', 10.0, 0.8, 'completed')
      insertTransactionItem(txn, productId, 1, 10.0)

      const report = generateClockOutReport(session.id)

      expect(report.sales_by_department.length).toBeGreaterThan(0)
      // Should have entry for 'Unknown' or similar
      expect(report.gross_sales).toBe(10.0)
    })

    it('returns empty arrays for department and payment breakdown when no transactions', () => {
      const cashierId = insertCashier('Alice')
      const session = createSession({ cashier_id: cashierId, cashier_name: 'Alice' })

      const report = generateClockOutReport(session.id)

      expect(Array.isArray(report.sales_by_department)).toBe(true)
      expect(Array.isArray(report.sales_by_payment_method)).toBe(true)
      expect(report.sales_by_department.length).toBe(0)
      expect(report.sales_by_payment_method.length).toBe(0)
    })
  })
})
