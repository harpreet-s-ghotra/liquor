import { dialog } from 'electron'
import { writeFileSync } from 'fs'
import PDFDocument from 'pdfkit'
import type {
  ReportDateRange,
  SalesSummaryReport,
  ProductSalesReport,
  CategorySalesReport,
  TaxReport,
  ComparisonReport,
  TransactionListReport
} from '../../shared/types'

type ReportType =
  | 'sales-summary'
  | 'product-sales'
  | 'category-sales'
  | 'tax-summary'
  | 'comparison'
  | 'transaction-list'
type ReportData =
  | SalesSummaryReport
  | ProductSalesReport
  | CategorySalesReport
  | TaxReport
  | ComparisonReport
  | TransactionListReport

type ExportMetadata = {
  store_name?: string | null
  merchant_name?: string | null
  merchant_id?: string | null
}

type TableColumn = {
  key: string
  title: string
  width: number
  align?: 'left' | 'right' | 'center'
}

function fmt(n: number): string {
  return `$${n.toFixed(2)}`
}

function fmtDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const date = parsed.toISOString().split('T')[0]
  const time = parsed.toISOString().split('T')[1]?.slice(0, 8) ?? ''
  return `${date} ${time}`
}

function rangeLabel(range: ReportDateRange): string {
  return `${range.from.split('T')[0]} to ${range.to.split('T')[0]}`
}

function addPdfHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  range: ReportDateRange,
  metadata?: ExportMetadata
): void {
  doc.font('Helvetica-Bold').fontSize(18).text(title, { align: 'left' })
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#666666')
    .text(`Store: ${metadata?.store_name ?? 'Unknown'}`, { align: 'left' })
    .text(`Merchant: ${metadata?.merchant_name ?? 'Unknown'}`, { align: 'left' })
    .text(`Finix Merchant ID: ${metadata?.merchant_id ?? 'Unknown'}`, { align: 'left' })
    .text(`Period: ${rangeLabel(range)}`, { align: 'left' })
    .text(`Generated: ${fmtDateTime(new Date().toISOString())}`, { align: 'left' })
  doc.moveDown(0.5)
  doc.fillColor('#000000')
}

function ensurePageSpace(doc: PDFKit.PDFDocument, neededHeight: number): void {
  const bottomLimit = doc.page.height - doc.page.margins.bottom
  if (doc.y + neededHeight > bottomLimit) {
    doc.addPage()
  }
}

function drawTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: Array<Record<string, string>>,
  title?: string
): void {
  if (title) {
    ensurePageSpace(doc, 26)
    doc.font('Helvetica-Bold').fontSize(11).text(title)
    doc.moveDown(0.4)
  }

  const rowHeight = 20
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0)
  const xStart = doc.page.margins.left

  ensurePageSpace(doc, rowHeight * 2)
  const headerTop = doc.y
  doc.rect(xStart, headerTop, totalWidth, rowHeight).fill('#F3F4F6')
  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9)

  let x = xStart
  for (const column of columns) {
    doc.text(column.title, x + 4, headerTop + 6, {
      width: column.width - 8,
      align: 'left'
    })
    x += column.width
  }

  doc.y = headerTop + rowHeight

  rows.forEach((row, rowIndex) => {
    ensurePageSpace(doc, rowHeight)

    const rowTop = doc.y
    if (rowIndex % 2 === 1) {
      doc.rect(xStart, rowTop, totalWidth, rowHeight).fill('#FAFAFA')
    }

    doc.fillColor('#111111').font('Helvetica').fontSize(9)
    let rowX = xStart
    for (const column of columns) {
      const value = row[column.key] ?? ''
      doc.text(value, rowX + 4, rowTop + 6, {
        width: column.width - 8,
        align: column.align ?? 'left'
      })
      rowX += column.width
    }

    doc
      .moveTo(xStart, rowTop + rowHeight)
      .lineTo(xStart + totalWidth, rowTop + rowHeight)
      .strokeColor('#E5E7EB')
      .lineWidth(0.5)
      .stroke()

    doc.y = rowTop + rowHeight
  })

  doc.moveDown(0.6)
}

function buildSalesSummaryPdf(
  doc: PDFKit.PDFDocument,
  data: SalesSummaryReport,
  range: ReportDateRange,
  metadata?: ExportMetadata
): void {
  addPdfHeader(doc, 'Sales Summary Report', range, metadata)

  drawTable(
    doc,
    [
      { key: 'metric', title: 'Metric', width: 280 },
      { key: 'value', title: 'Value', width: 240, align: 'right' }
    ],
    [
      { metric: 'Gross Sales (Period Total)', value: fmt(data.gross_sales) },
      { metric: 'Tax Collected (Period Total)', value: fmt(data.tax_collected) },
      { metric: 'Net Sales (Period Total)', value: fmt(data.net_sales) },
      { metric: 'Transactions', value: String(data.transaction_count) },
      { metric: 'Average Transaction', value: fmt(data.avg_transaction) },
      { metric: 'Refund Count', value: String(data.refund_count) },
      { metric: 'Refund Amount', value: fmt(data.refund_amount) }
    ],
    'Period Totals'
  )

  if (data.sales_by_payment.length > 0) {
    drawTable(
      doc,
      [
        { key: 'payment_method', title: 'Payment Method', width: 200 },
        { key: 'transaction_count', title: 'Transactions', width: 140, align: 'right' },
        { key: 'total_amount', title: 'Total Amount', width: 192, align: 'right' }
      ],
      data.sales_by_payment.map((row) => ({
        payment_method: row.payment_method,
        transaction_count: String(row.transaction_count),
        total_amount: fmt(row.total_amount)
      })),
      'Sales by Payment Method'
    )
  }

  if (data.sales_by_card_brand.length > 0) {
    drawTable(
      doc,
      [
        { key: 'card_brand', title: 'Card Brand', width: 200 },
        { key: 'transaction_count', title: 'Transactions', width: 140, align: 'right' },
        { key: 'total_amount', title: 'Total Amount', width: 192, align: 'right' }
      ],
      data.sales_by_card_brand.map((row) => ({
        card_brand: row.card_brand,
        transaction_count: String(row.transaction_count),
        total_amount: fmt(row.total_amount)
      })),
      'Sales by Card Brand'
    )
  }

  if (data.sales_by_day.length > 0) {
    drawTable(
      doc,
      [
        { key: 'date', title: 'Date', width: 120 },
        { key: 'transaction_count', title: 'Transactions', width: 100, align: 'right' },
        { key: 'gross_sales', title: 'Gross Sales', width: 104, align: 'right' },
        { key: 'tax_collected', title: 'Tax Collected', width: 104, align: 'right' },
        { key: 'net_sales', title: 'Net Sales', width: 104, align: 'right' }
      ],
      data.sales_by_day.map((row) => ({
        date: row.date,
        transaction_count: String(row.transaction_count),
        gross_sales: fmt(row.gross_sales),
        tax_collected: fmt(row.tax_collected),
        net_sales: fmt(row.net_sales)
      })),
      'Daily Sales Breakdown'
    )
  }
}

function buildProductSalesPdf(
  doc: PDFKit.PDFDocument,
  data: ProductSalesReport,
  range: ReportDateRange,
  metadata?: ExportMetadata
): void {
  addPdfHeader(doc, 'Product Sales Report', range, metadata)

  drawTable(
    doc,
    [
      { key: 'product_name', title: 'Product', width: 170 },
      { key: 'distributor_name', title: 'Distributor', width: 104 },
      { key: 'sku', title: 'SKU', width: 80 },
      { key: 'item_type', title: 'Category', width: 70 },
      { key: 'quantity_sold', title: 'Qty', width: 54, align: 'right' },
      { key: 'revenue', title: 'Revenue', width: 64, align: 'right' },
      { key: 'profit', title: 'Profit', width: 64, align: 'right' }
    ],
    data.items.map((item) => ({
      product_name: item.product_name,
      distributor_name: item.distributor_name ?? 'Unassigned',
      sku: item.sku,
      item_type: item.item_type ?? 'Unknown',
      quantity_sold: String(item.quantity_sold),
      revenue: fmt(item.revenue),
      profit: fmt(item.profit)
    })),
    'Product Breakdown'
  )

  const totalRevenue = data.items.reduce((sum, row) => sum + row.revenue, 0)
  const totalProfit = data.items.reduce((sum, row) => sum + row.profit, 0)
  drawTable(
    doc,
    [
      { key: 'metric', title: 'Metric', width: 280 },
      { key: 'value', title: 'Value', width: 240, align: 'right' }
    ],
    [
      { metric: 'Revenue (Period Total)', value: fmt(totalRevenue) },
      { metric: 'Profit (Period Total)', value: fmt(totalProfit) }
    ],
    'Totals'
  )
}

function buildCategorySalesPdf(
  doc: PDFKit.PDFDocument,
  data: CategorySalesReport,
  range: ReportDateRange,
  metadata?: ExportMetadata
): void {
  addPdfHeader(doc, 'Category Sales Report', range, metadata)

  drawTable(
    doc,
    [
      { key: 'item_type', title: 'Category', width: 180 },
      { key: 'transaction_count', title: 'Transactions', width: 100, align: 'right' },
      { key: 'quantity_sold', title: 'Qty Sold', width: 80, align: 'right' },
      { key: 'revenue', title: 'Revenue', width: 76, align: 'right' },
      { key: 'profit', title: 'Profit', width: 76, align: 'right' },
      { key: 'profit_margin_pct', title: 'Profit %', width: 56, align: 'right' }
    ],
    data.categories.map((cat) => ({
      item_type: cat.item_type,
      transaction_count: String(cat.transaction_count),
      quantity_sold: String(cat.quantity_sold),
      revenue: fmt(cat.revenue),
      profit: fmt(cat.profit),
      profit_margin_pct: `${cat.profit_margin_pct.toFixed(1)}%`
    })),
    'Category Breakdown'
  )

  const totalRevenue = data.categories.reduce((sum, row) => sum + row.revenue, 0)
  const totalProfit = data.categories.reduce((sum, row) => sum + row.profit, 0)
  drawTable(
    doc,
    [
      { key: 'metric', title: 'Metric', width: 280 },
      { key: 'value', title: 'Value', width: 240, align: 'right' }
    ],
    [
      { metric: 'Revenue (Period Total)', value: fmt(totalRevenue) },
      { metric: 'Profit (Period Total)', value: fmt(totalProfit) }
    ],
    'Totals'
  )
}

function buildTaxReportPdf(
  doc: PDFKit.PDFDocument,
  data: TaxReport,
  range: ReportDateRange,
  metadata?: ExportMetadata
): void {
  addPdfHeader(doc, 'Tax Summary Report', range, metadata)

  drawTable(
    doc,
    [
      { key: 'tax_code_name', title: 'Tax Code', width: 180 },
      { key: 'tax_rate', title: 'Rate %', width: 80, align: 'right' },
      { key: 'taxable_sales', title: 'Taxable Sales', width: 136, align: 'right' },
      { key: 'tax_collected', title: 'Tax Collected', width: 136, align: 'right' }
    ],
    data.tax_rows.map((row) => ({
      tax_code_name: row.tax_code_name,
      tax_rate: row.tax_rate.toFixed(2),
      taxable_sales: fmt(row.taxable_sales),
      tax_collected: fmt(row.tax_collected)
    })),
    'Tax Breakdown'
  )
}

function buildComparisonPdf(
  doc: PDFKit.PDFDocument,
  data: ComparisonReport,
  range: ReportDateRange,
  metadata?: ExportMetadata
): void {
  addPdfHeader(doc, 'Comparison Report', range, metadata)

  drawTable(
    doc,
    [
      { key: 'field', title: 'Metric', width: 150 },
      { key: 'period_a_value', title: 'Period A', width: 130, align: 'right' },
      { key: 'period_b_value', title: 'Period B', width: 130, align: 'right' },
      { key: 'change_pct', title: 'Change %', width: 122, align: 'right' }
    ],
    data.deltas.map((d) => ({
      field: d.field,
      period_a_value: fmt(d.period_a_value),
      period_b_value: fmt(d.period_b_value),
      change_pct: `${d.change_pct > 0 ? '+' : ''}${d.change_pct.toFixed(1)}%`
    })),
    'Comparison Metrics'
  )
}

function buildTransactionListPdf(
  doc: PDFKit.PDFDocument,
  data: TransactionListReport,
  range: ReportDateRange,
  metadata?: ExportMetadata
): void {
  addPdfHeader(doc, 'All Transactions Report', range, metadata)

  drawTable(
    doc,
    [
      { key: 'transaction_number', title: 'Transaction #', width: 145 },
      { key: 'created_at', title: 'Date/Time', width: 145 },
      { key: 'cashier_name', title: 'Cashier', width: 100 },
      { key: 'register_name', title: 'Register', width: 90 },
      { key: 'status', title: 'Status', width: 52 }
    ],
    data.transactions.map((row) => ({
      transaction_number: row.transaction_number,
      created_at: fmtDateTime(row.created_at),
      cashier_name: row.cashier_name,
      register_name: row.register_name,
      status: row.status
    })),
    'Transactions'
  )
}

export async function exportToPdf(
  data: ReportData,
  reportType: ReportType,
  range: ReportDateRange,
  metadata?: ExportMetadata
): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: 'Save Report as PDF',
    defaultPath: `${reportType}-report.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })

  if (result.canceled || !result.filePath) return null

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks)
        writeFileSync(result.filePath!, buffer)
        resolve(result.filePath!)
      } catch (err) {
        reject(err)
      }
    })
    doc.on('error', reject)

    switch (reportType) {
      case 'sales-summary':
        buildSalesSummaryPdf(doc, data as SalesSummaryReport, range, metadata)
        break
      case 'product-sales':
        buildProductSalesPdf(doc, data as ProductSalesReport, range, metadata)
        break
      case 'category-sales':
        buildCategorySalesPdf(doc, data as CategorySalesReport, range, metadata)
        break
      case 'tax-summary':
        buildTaxReportPdf(doc, data as TaxReport, range, metadata)
        break
      case 'comparison':
        buildComparisonPdf(doc, data as ComparisonReport, range, metadata)
        break
      case 'transaction-list':
        buildTransactionListPdf(doc, data as TransactionListReport, range, metadata)
        break
    }

    doc.end()
  })
}

function csvHeader(range: ReportDateRange, metadata?: ExportMetadata): string[] {
  return [
    `Store,${metadata?.store_name ?? 'Unknown'}`,
    `Merchant Name,${metadata?.merchant_name ?? 'Unknown'}`,
    `Finix Merchant ID,${metadata?.merchant_id ?? 'Unknown'}`,
    `Period,${rangeLabel(range)}`,
    `Generated At,${fmtDateTime(new Date().toISOString())}`,
    ''
  ]
}

function salesSummaryCsv(
  data: SalesSummaryReport,
  range: ReportDateRange,
  metadata?: ExportMetadata
): string {
  const lines: string[] = []
  lines.push(...csvHeader(range, metadata))
  lines.push('Period Totals')
  lines.push('Metric,Value')
  lines.push(`Gross Sales (Period Total),${data.gross_sales}`)
  lines.push(`Tax Collected (Period Total),${data.tax_collected}`)
  lines.push(`Net Sales (Period Total),${data.net_sales}`)
  lines.push(`Transaction Count,${data.transaction_count}`)
  lines.push(`Avg Transaction,${data.avg_transaction}`)
  lines.push(`Refund Count,${data.refund_count}`)
  lines.push(`Refund Amount,${data.refund_amount}`)
  lines.push('')
  lines.push('Payment Method,Transaction Count,Total Amount')
  for (const row of data.sales_by_payment) {
    lines.push(`${row.payment_method},${row.transaction_count},${row.total_amount}`)
  }
  lines.push('')
  lines.push('Card Brand,Transaction Count,Total Amount')
  for (const row of data.sales_by_card_brand) {
    lines.push(`${row.card_brand},${row.transaction_count},${row.total_amount}`)
  }
  lines.push('')
  lines.push('Date,Transaction Count,Gross Sales,Tax Collected,Net Sales')
  for (const row of data.sales_by_day) {
    lines.push(
      `${row.date},${row.transaction_count},${row.gross_sales},${row.tax_collected},${row.net_sales}`
    )
  }
  return lines.join('\n')
}

function productSalesCsv(
  data: ProductSalesReport,
  range: ReportDateRange,
  metadata?: ExportMetadata
): string {
  const lines: string[] = []
  lines.push(...csvHeader(range, metadata))
  lines.push('Product,Distributor,SKU,Item Type,Qty Sold,Revenue,Cost,Profit,Margin %')

  const totalQty = data.items.reduce((sum, item) => sum + item.quantity_sold, 0)
  const totalRevenue = data.items.reduce((sum, item) => sum + item.revenue, 0)
  const totalCost = data.items.reduce((sum, item) => sum + item.cost_total, 0)
  const totalProfit = data.items.reduce((sum, item) => sum + item.profit, 0)

  for (const item of data.items) {
    const name = `"${item.product_name.replace(/"/g, '""')}"`
    const distributor = `"${(item.distributor_name ?? 'Unassigned').replace(/"/g, '""')}"`
    lines.push(
      `${name},${distributor},${item.sku},${item.item_type ?? ''},${item.quantity_sold},${item.revenue},${item.cost_total},${item.profit},${item.margin_pct}`
    )
  }
  lines.push(`"Period Totals",,,,${totalQty},${totalRevenue},${totalCost},${totalProfit},`)
  return lines.join('\n')
}

function categorySalesCsv(
  data: CategorySalesReport,
  range: ReportDateRange,
  metadata?: ExportMetadata
): string {
  const lines: string[] = []
  lines.push(...csvHeader(range, metadata))
  lines.push('Category,Transaction Count,Qty Sold,Revenue,Profit,Profit Margin %')

  const totalTx = data.categories.reduce((sum, cat) => sum + cat.transaction_count, 0)
  const totalQty = data.categories.reduce((sum, cat) => sum + cat.quantity_sold, 0)
  const totalRevenue = data.categories.reduce((sum, cat) => sum + cat.revenue, 0)
  const totalProfit = data.categories.reduce((sum, cat) => sum + cat.profit, 0)

  for (const cat of data.categories) {
    lines.push(
      `${cat.item_type},${cat.transaction_count},${cat.quantity_sold},${cat.revenue},${cat.profit},${cat.profit_margin_pct}`
    )
  }
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
  lines.push(
    `Period Totals,${totalTx},${totalQty},${totalRevenue},${totalProfit},${totalMargin.toFixed(1)}`
  )
  return lines.join('\n')
}

function taxReportCsv(data: TaxReport, range: ReportDateRange, metadata?: ExportMetadata): string {
  const lines: string[] = []
  lines.push(...csvHeader(range, metadata))
  lines.push('Tax Code,Tax Rate %,Taxable Sales,Tax Collected')
  for (const row of data.tax_rows) {
    lines.push(`${row.tax_code_name},${row.tax_rate},${row.taxable_sales},${row.tax_collected}`)
  }
  return lines.join('\n')
}

function comparisonCsv(
  data: ComparisonReport,
  range: ReportDateRange,
  metadata?: ExportMetadata
): string {
  const lines: string[] = []
  lines.push(...csvHeader(range, metadata))
  lines.push('Field,Period A,Period B,Diff,Change %')
  for (const d of data.deltas) {
    lines.push(`${d.field},${d.period_a_value},${d.period_b_value},${d.diff},${d.change_pct}`)
  }
  return lines.join('\n')
}

function transactionListCsv(
  data: TransactionListReport,
  range: ReportDateRange,
  metadata?: ExportMetadata
): string {
  const lines: string[] = []
  lines.push(...csvHeader(range, metadata))
  lines.push('Transaction Number,Date Time,Cashier,Register,Status')
  for (const row of data.transactions) {
    const txn = `"${row.transaction_number.replace(/"/g, '""')}"`
    const cashier = `"${row.cashier_name.replace(/"/g, '""')}"`
    const registerName = `"${row.register_name.replace(/"/g, '""')}"`
    lines.push(`${txn},${fmtDateTime(row.created_at)},${cashier},${registerName},${row.status}`)
  }
  return lines.join('\n')
}

function toCsv(
  data: ReportData,
  reportType: ReportType,
  range: ReportDateRange,
  metadata?: ExportMetadata
): string {
  switch (reportType) {
    case 'sales-summary':
      return salesSummaryCsv(data as SalesSummaryReport, range, metadata)
    case 'product-sales':
      return productSalesCsv(data as ProductSalesReport, range, metadata)
    case 'category-sales':
      return categorySalesCsv(data as CategorySalesReport, range, metadata)
    case 'tax-summary':
      return taxReportCsv(data as TaxReport, range, metadata)
    case 'comparison':
      return comparisonCsv(data as ComparisonReport, range, metadata)
    case 'transaction-list':
      return transactionListCsv(data as TransactionListReport, range, metadata)
  }
}

export async function exportToCsv(
  data: ReportData,
  reportType: ReportType,
  range: ReportDateRange,
  metadata?: ExportMetadata
): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: 'Save Report as CSV',
    defaultPath: `${reportType}-report.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  })

  if (result.canceled || !result.filePath) return null

  const csv = toCsv(data, reportType, range, metadata)
  writeFileSync(result.filePath, csv, 'utf-8')
  return result.filePath
}
