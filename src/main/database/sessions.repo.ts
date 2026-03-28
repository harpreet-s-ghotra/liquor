import { getDb } from './connection'
import { normalizeTimestamp } from './utils'
import type {
  Session,
  CreateSessionInput,
  CloseSessionInput,
  ClockOutReport,
  DepartmentSalesRow,
  PaymentMethodSalesRow,
  SessionListResult
} from '../../shared/types'

function normalizeSession(s: Session): Session {
  return {
    ...s,
    started_at: normalizeTimestamp(s.started_at),
    ended_at: s.ended_at ? normalizeTimestamp(s.ended_at) : null
  }
}

/**
 * Create a new register session. Throws if an active session already exists.
 */
export function createSession(input: CreateSessionInput): Session {
  const db = getDb()

  const existing = db.prepare("SELECT id FROM sessions WHERE status = 'active' LIMIT 1").get() as
    | { id: number }
    | undefined

  if (existing) {
    throw new Error('An active session already exists')
  }

  const result = db
    .prepare(
      `
      INSERT INTO sessions (opened_by_cashier_id, opened_by_cashier_name, status)
      VALUES (@cashier_id, @cashier_name, 'active')
      `
    )
    .run({
      cashier_id: input.cashier_id,
      cashier_name: input.cashier_name
    })

  return normalizeSession(
    db.prepare('SELECT * FROM sessions WHERE id = ?').get(Number(result.lastInsertRowid)) as Session
  )
}

/**
 * Get the current active session, or null if no session is active.
 */
export function getActiveSession(): Session | null {
  const row = getDb()
    .prepare("SELECT * FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1")
    .get() as Session | undefined
  return row ? normalizeSession(row) : null
}

/**
 * Close an active session (clock out). Throws if the session does not exist or is already closed.
 */
export function closeSession(input: CloseSessionInput): Session {
  const db = getDb()

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(input.session_id) as
    | Session
    | undefined

  if (!session) {
    throw new Error('Session not found')
  }
  if (session.status === 'closed') {
    throw new Error('Session is already closed')
  }

  db.prepare(
    `
    UPDATE sessions
    SET status = 'closed',
        ended_at = CURRENT_TIMESTAMP,
        closed_by_cashier_id = @cashier_id,
        closed_by_cashier_name = @cashier_name
    WHERE id = @session_id
    `
  ).run({
    session_id: input.session_id,
    cashier_id: input.cashier_id,
    cashier_name: input.cashier_name
  })

  return normalizeSession(
    db.prepare('SELECT * FROM sessions WHERE id = ?').get(input.session_id) as Session
  )
}

/**
 * Paginated list of sessions, most recent first.
 */
export function listSessions(limit: number, offset: number): SessionListResult {
  const db = getDb()

  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM sessions').get() as { cnt: number }

  const sessions = (
    db
      .prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as Session[]
  ).map(normalizeSession)

  return { sessions, total_count: countRow.cnt }
}

/**
 * Generate a full End-of-Day report for a session.
 */
export function generateClockOutReport(sessionId: number): ClockOutReport {
  const db = getDb()

  const rawSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as
    | Session
    | undefined

  if (!rawSession) {
    throw new Error('Session not found')
  }

  const session = normalizeSession(rawSession)

  // Sales by department
  const salesByDept = db
    .prepare(
      `
      SELECT
        COALESCE(d.name, p.dept_id, 'Unknown') AS department_name,
        COUNT(DISTINCT t.id) AS transaction_count,
        COALESCE(SUM(ti.total_price), 0) AS total_amount
      FROM transactions t
      INNER JOIN transaction_items ti ON ti.transaction_id = t.id
      LEFT JOIN products p ON p.id = ti.product_id
      LEFT JOIN departments d ON d.id = CAST(p.dept_id AS INTEGER)
      WHERE t.session_id = ? AND t.status = 'completed'
      GROUP BY department_name
      ORDER BY total_amount DESC
      `
    )
    .all(sessionId) as DepartmentSalesRow[]

  // Sales by payment method
  const salesByPayment = db
    .prepare(
      `
      SELECT
        payment_method,
        COUNT(*) AS transaction_count,
        COALESCE(SUM(total), 0) AS total_amount
      FROM transactions
      WHERE session_id = ? AND status = 'completed'
      GROUP BY payment_method
      ORDER BY total_amount DESC
      `
    )
    .all(sessionId) as PaymentMethodSalesRow[]

  // Aggregate totals for completed transactions
  const totals = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total_sales_count,
        COALESCE(SUM(total), 0) AS gross_sales,
        COALESCE(SUM(tax_amount), 0) AS total_tax_collected
      FROM transactions
      WHERE session_id = ? AND status = 'completed'
      `
    )
    .get(sessionId) as {
    total_sales_count: number
    gross_sales: number
    total_tax_collected: number
  }

  // Refund totals
  const refunds = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total_refund_count,
        COALESCE(SUM(ABS(total)), 0) AS total_refund_amount
      FROM transactions
      WHERE session_id = ? AND status = 'refund'
      `
    )
    .get(sessionId) as { total_refund_count: number; total_refund_amount: number }

  // Cash/credit/debit breakdown
  const cashBreakdown = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'cash' AND status = 'completed' THEN total ELSE 0 END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' AND status = 'refund' THEN ABS(total) ELSE 0 END), 0) AS cash_refunds,
        COALESCE(SUM(CASE WHEN payment_method = 'credit' AND status = 'completed' THEN total ELSE 0 END), 0) AS credit_total,
        COALESCE(SUM(CASE WHEN payment_method = 'debit' AND status = 'completed' THEN total ELSE 0 END), 0) AS debit_total
      FROM transactions
      WHERE session_id = ?
      `
    )
    .get(sessionId) as {
    cash_sales: number
    cash_refunds: number
    credit_total: number
    debit_total: number
  }

  const netSales = totals.gross_sales - totals.total_tax_collected
  const averageTransactionValue =
    totals.total_sales_count > 0 ? totals.gross_sales / totals.total_sales_count : 0
  const expectedCashAtClose = cashBreakdown.cash_sales - cashBreakdown.cash_refunds

  return {
    session,
    sales_by_department: salesByDept,
    sales_by_payment_method: salesByPayment,
    total_sales_count: totals.total_sales_count,
    gross_sales: totals.gross_sales,
    total_tax_collected: totals.total_tax_collected,
    net_sales: netSales,
    total_refund_count: refunds.total_refund_count,
    total_refund_amount: refunds.total_refund_amount,
    average_transaction_value: averageTransactionValue,
    expected_cash_at_close: expectedCashAtClose,
    cash_total: cashBreakdown.cash_sales,
    credit_total: cashBreakdown.credit_total,
    debit_total: cashBreakdown.debit_total
  }
}
