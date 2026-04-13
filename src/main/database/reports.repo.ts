import { getDb } from './connection'
import { toSqliteFormat } from './utils'
import type {
  ReportDateRange,
  SalesSummaryReport,
  DailySalesRow,
  PaymentMethodSalesRow,
  ProductSalesReport,
  ProductSalesRow,
  CategorySalesReport,
  CategorySalesRow,
  TaxReport,
  TaxReportRow,
  ComparisonReport,
  ComparisonDelta,
  CashierSalesReport,
  CashierSalesRow,
  HourlySalesReport,
  HourlySalesRow
} from '../../shared/types'

function dateWhere(range: ReportDateRange): { from: string; to: string } {
  return {
    from: toSqliteFormat(range.from),
    to: toSqliteFormat(range.to)
  }
}

export function getSalesSummary(range: ReportDateRange): SalesSummaryReport {
  const db = getDb()
  const { from, to } = dateWhere(range)

  const totals = db
    .prepare(
      `
      SELECT
        COUNT(*) AS transaction_count,
        COALESCE(SUM(total), 0) AS gross_sales,
        COALESCE(SUM(tax_amount), 0) AS tax_collected
      FROM transactions
      WHERE status = 'completed'
        AND created_at >= ? AND created_at <= ?
      `
    )
    .get(from, to) as { transaction_count: number; gross_sales: number; tax_collected: number }

  const refunds = db
    .prepare(
      `
      SELECT
        COUNT(*) AS refund_count,
        COALESCE(SUM(ABS(total)), 0) AS refund_amount
      FROM transactions
      WHERE status = 'refund'
        AND created_at >= ? AND created_at <= ?
      `
    )
    .get(from, to) as { refund_count: number; refund_amount: number }

  const salesByPayment = db
    .prepare(
      `
      SELECT
        payment_method,
        COUNT(*) AS transaction_count,
        COALESCE(SUM(total), 0) AS total_amount
      FROM transactions
      WHERE status = 'completed'
        AND created_at >= ? AND created_at <= ?
      GROUP BY payment_method
      ORDER BY total_amount DESC
      `
    )
    .all(from, to) as PaymentMethodSalesRow[]

  const salesByDay = db
    .prepare(
      `
      SELECT
        DATE(created_at) AS date,
        COUNT(*) AS transaction_count,
        COALESCE(SUM(total), 0) AS gross_sales,
        COALESCE(SUM(tax_amount), 0) AS tax_collected,
        COALESCE(SUM(total - tax_amount), 0) AS net_sales
      FROM transactions
      WHERE status = 'completed'
        AND created_at >= ? AND created_at <= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
      `
    )
    .all(from, to) as DailySalesRow[]

  const netSales = totals.gross_sales - totals.tax_collected
  const avgTransaction =
    totals.transaction_count > 0 ? totals.gross_sales / totals.transaction_count : 0

  return {
    gross_sales: totals.gross_sales,
    tax_collected: totals.tax_collected,
    net_sales: netSales,
    refund_count: refunds.refund_count,
    refund_amount: refunds.refund_amount,
    transaction_count: totals.transaction_count,
    avg_transaction: Math.round(avgTransaction * 100) / 100,
    sales_by_payment: salesByPayment,
    sales_by_day: salesByDay
  }
}

export function getProductSales(
  range: ReportDateRange,
  sortBy: 'revenue' | 'quantity' = 'revenue',
  limit = 50
): ProductSalesReport {
  const db = getDb()
  const { from, to } = dateWhere(range)

  const orderCol = sortBy === 'quantity' ? 'quantity_sold' : 'revenue'

  const items = db
    .prepare(
      `
      SELECT
        ti.product_id,
        ti.product_name,
        COALESCE(p.item_type, 'Unknown') AS item_type,
        COALESCE(p.sku, '') AS sku,
        COALESCE(SUM(ti.quantity), 0) AS quantity_sold,
        COALESCE(SUM(ti.total_price), 0) AS revenue,
        COALESCE(SUM(ti.quantity * COALESCE(p.cost, 0)), 0) AS cost_total
      FROM transaction_items ti
      INNER JOIN transactions t ON t.id = ti.transaction_id
      LEFT JOIN products p ON p.id = ti.product_id
      WHERE t.status = 'completed'
        AND t.created_at >= ? AND t.created_at <= ?
      GROUP BY ti.product_id, ti.product_name
      ORDER BY ${orderCol} DESC
      LIMIT ?
      `
    )
    .all(from, to, limit) as Array<
    Omit<ProductSalesRow, 'profit' | 'margin_pct'> & { cost_total: number }
  >

  const result: ProductSalesRow[] = items.map((item) => {
    const profit = item.revenue - item.cost_total
    const marginPct = item.revenue > 0 ? (profit / item.revenue) * 100 : 0
    return {
      ...item,
      profit: Math.round(profit * 100) / 100,
      margin_pct: Math.round(marginPct * 10) / 10
    }
  })

  return { items: result }
}

export function getCategorySales(range: ReportDateRange): CategorySalesReport {
  const db = getDb()
  const { from, to } = dateWhere(range)

  const categories = db
    .prepare(
      `
      SELECT
        COALESCE(p.item_type, 'Unknown') AS item_type,
        COUNT(DISTINCT t.id) AS transaction_count,
        COALESCE(SUM(ti.quantity), 0) AS quantity_sold,
        COALESCE(SUM(ti.total_price), 0) AS revenue,
        COALESCE(SUM(ti.total_price) - SUM(ti.quantity * COALESCE(p.cost, 0)), 0) AS profit
      FROM transaction_items ti
      INNER JOIN transactions t ON t.id = ti.transaction_id
      LEFT JOIN products p ON p.id = ti.product_id
      WHERE t.status = 'completed'
        AND t.created_at >= ? AND t.created_at <= ?
      GROUP BY item_type
      ORDER BY revenue DESC
      `
    )
    .all(from, to) as CategorySalesRow[]

  return { categories }
}

export function getTaxSummary(range: ReportDateRange): TaxReport {
  const db = getDb()
  const { from, to } = dateWhere(range)

  // Products store tax_1 and tax_2 rates directly. We group by effective tax rate
  // from the product, calculating taxable sales from the line items.
  const taxRows = db
    .prepare(
      `
      SELECT
        CASE
          WHEN COALESCE(p.tax_1, p.tax_rate, 0) = 0 THEN 'Non-Taxable'
          ELSE CAST(ROUND(COALESCE(p.tax_1, p.tax_rate, 0) * 100, 2) AS TEXT) || '%'
        END AS tax_code_name,
        COALESCE(p.tax_1, p.tax_rate, 0) * 100 AS tax_rate,
        COALESCE(SUM(ti.total_price), 0) AS taxable_sales,
        COALESCE(SUM(ti.total_price * COALESCE(p.tax_1, p.tax_rate, 0)), 0) AS tax_collected
      FROM transaction_items ti
      INNER JOIN transactions t ON t.id = ti.transaction_id
      LEFT JOIN products p ON p.id = ti.product_id
      WHERE t.status = 'completed'
        AND t.created_at >= ? AND t.created_at <= ?
      GROUP BY tax_code_name
      ORDER BY tax_collected DESC
      `
    )
    .all(from, to) as TaxReportRow[]

  return { tax_rows: taxRows }
}

export function getComparisonData(
  rangeA: ReportDateRange,
  rangeB: ReportDateRange
): ComparisonReport {
  const periodA = getSalesSummary(rangeA)
  const periodB = getSalesSummary(rangeB)

  const fields: Array<{ field: string; a: number; b: number }> = [
    { field: 'Gross Sales', a: periodA.gross_sales, b: periodB.gross_sales },
    { field: 'Net Sales', a: periodA.net_sales, b: periodB.net_sales },
    { field: 'Tax Collected', a: periodA.tax_collected, b: periodB.tax_collected },
    { field: 'Transactions', a: periodA.transaction_count, b: periodB.transaction_count },
    { field: 'Avg Transaction', a: periodA.avg_transaction, b: periodB.avg_transaction },
    { field: 'Refunds', a: periodA.refund_amount, b: periodB.refund_amount }
  ]

  const deltas: ComparisonDelta[] = fields.map(({ field, a, b }) => {
    const diff = b - a
    const changePct = a !== 0 ? (diff / Math.abs(a)) * 100 : b !== 0 ? 100 : 0
    return {
      field,
      period_a_value: a,
      period_b_value: b,
      diff: Math.round(diff * 100) / 100,
      change_pct: Math.round(changePct * 10) / 10
    }
  })

  return { period_a: periodA, period_b: periodB, deltas }
}

export function getCashierSales(range: ReportDateRange): CashierSalesReport {
  const db = getDb()
  const { from, to } = dateWhere(range)

  const cashiers = db
    .prepare(
      `
      SELECT
        s.opened_by_cashier_id AS cashier_id,
        s.opened_by_cashier_name AS cashier_name,
        COUNT(*) AS transaction_count,
        COALESCE(SUM(t.total), 0) AS gross_sales
      FROM transactions t
      INNER JOIN sessions s ON s.id = t.session_id
      WHERE t.status = 'completed'
        AND t.created_at >= ? AND t.created_at <= ?
      GROUP BY s.opened_by_cashier_id, s.opened_by_cashier_name
      ORDER BY gross_sales DESC
      `
    )
    .all(from, to) as Array<Omit<CashierSalesRow, 'avg_transaction'>>

  const result: CashierSalesRow[] = cashiers.map((c) => ({
    ...c,
    avg_transaction:
      c.transaction_count > 0 ? Math.round((c.gross_sales / c.transaction_count) * 100) / 100 : 0
  }))

  return { cashiers: result }
}

export function getHourlySales(range: ReportDateRange): HourlySalesReport {
  const db = getDb()
  const { from, to } = dateWhere(range)

  const hours = db
    .prepare(
      `
      SELECT
        CAST(strftime('%H', created_at) AS INTEGER) AS hour,
        COUNT(*) AS transaction_count,
        COALESCE(SUM(total), 0) AS gross_sales
      FROM transactions
      WHERE status = 'completed'
        AND created_at >= ? AND created_at <= ?
      GROUP BY hour
      ORDER BY hour ASC
      `
    )
    .all(from, to) as HourlySalesRow[]

  return { hours }
}
