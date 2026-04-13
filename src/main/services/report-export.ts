import { dialog } from 'electron'
import { writeFileSync } from 'fs'
import PDFDocument from 'pdfkit'
import type {
  ReportDateRange,
  SalesSummaryReport,
  ProductSalesReport,
  CategorySalesReport,
  TaxReport,
  ComparisonReport
} from '../../shared/types'

type ReportType =
  | 'sales-summary'
  | 'product-sales'
  | 'category-sales'
  | 'tax-summary'
  | 'comparison'
type ReportData =
  | SalesSummaryReport
  | ProductSalesReport
  | CategorySalesReport
  | TaxReport
  | ComparisonReport

function fmt(n: number): string {
  return `$${n.toFixed(2)}`
}

function rangeLabel(range: ReportDateRange): string {
  return `${range.from.split('T')[0]} to ${range.to.split('T')[0]}`
}

function addPdfHeader(doc: PDFKit.PDFDocument, title: string, range: ReportDateRange): void {
  doc.font('Helvetica-Bold').fontSize(16).text(title, { align: 'center' })
  doc.font('Helvetica').fontSize(10).text(rangeLabel(range), { align: 'center' })
  doc.moveDown(1)
}

function buildSalesSummaryPdf(
  doc: PDFKit.PDFDocument,
  data: SalesSummaryReport,
  range: ReportDateRange
): void {
  addPdfHeader(doc, 'Sales Summary Report', range)
  doc.font('Helvetica').fontSize(10)
  doc.text(`Gross Sales: ${fmt(data.gross_sales)}`)
  doc.text(`Tax Collected: ${fmt(data.tax_collected)}`)
  doc.text(`Net Sales: ${fmt(data.net_sales)}`)
  doc.text(`Transactions: ${data.transaction_count}`)
  doc.text(`Avg Transaction: ${fmt(data.avg_transaction)}`)
  doc.text(`Refunds: ${data.refund_count} (${fmt(data.refund_amount)})`)
  doc.moveDown(1)

  if (data.sales_by_payment.length > 0) {
    doc.font('Helvetica-Bold').fontSize(11).text('Sales by Payment Method')
    doc.font('Helvetica').fontSize(10)
    for (const row of data.sales_by_payment) {
      doc.text(`  ${row.payment_method}: ${row.transaction_count} txns, ${fmt(row.total_amount)}`)
    }
    doc.moveDown(1)
  }

  if (data.sales_by_day.length > 0) {
    doc.font('Helvetica-Bold').fontSize(11).text('Daily Sales')
    doc.font('Helvetica').fontSize(10)
    for (const row of data.sales_by_day) {
      doc.text(
        `  ${row.date}: ${row.transaction_count} txns, Gross ${fmt(row.gross_sales)}, Tax ${fmt(row.tax_collected)}`
      )
    }
  }
}

function buildProductSalesPdf(
  doc: PDFKit.PDFDocument,
  data: ProductSalesReport,
  range: ReportDateRange
): void {
  addPdfHeader(doc, 'Product Sales Report', range)
  doc.font('Helvetica').fontSize(10)
  for (const item of data.items) {
    doc.text(
      `${item.product_name} (${item.sku}) - Qty: ${item.quantity_sold}, Revenue: ${fmt(item.revenue)}, Profit: ${fmt(item.profit)} (${item.margin_pct}%)`
    )
  }
}

function buildCategorySalesPdf(
  doc: PDFKit.PDFDocument,
  data: CategorySalesReport,
  range: ReportDateRange
): void {
  addPdfHeader(doc, 'Category Sales Report', range)
  doc.font('Helvetica').fontSize(10)
  for (const cat of data.categories) {
    doc.text(
      `${cat.item_type} - ${cat.transaction_count} txns, Qty: ${cat.quantity_sold}, Revenue: ${fmt(cat.revenue)}, Profit: ${fmt(cat.profit)}`
    )
  }
}

function buildTaxReportPdf(doc: PDFKit.PDFDocument, data: TaxReport, range: ReportDateRange): void {
  addPdfHeader(doc, 'Tax Summary Report', range)
  doc.font('Helvetica').fontSize(10)
  for (const row of data.tax_rows) {
    doc.text(
      `${row.tax_code_name} (${row.tax_rate}%) - Taxable Sales: ${fmt(row.taxable_sales)}, Tax Collected: ${fmt(row.tax_collected)}`
    )
  }
}

function buildComparisonPdf(
  doc: PDFKit.PDFDocument,
  data: ComparisonReport,
  range: ReportDateRange
): void {
  addPdfHeader(doc, 'Comparison Report', range)
  doc.font('Helvetica').fontSize(10)
  for (const d of data.deltas) {
    const sign = d.change_pct >= 0 ? '+' : ''
    doc.text(
      `${d.field}: Period A ${fmt(d.period_a_value)} -> Period B ${fmt(d.period_b_value)} (${sign}${d.change_pct}%)`
    )
  }
}

export async function exportToPdf(
  data: ReportData,
  reportType: ReportType,
  range: ReportDateRange
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
        buildSalesSummaryPdf(doc, data as SalesSummaryReport, range)
        break
      case 'product-sales':
        buildProductSalesPdf(doc, data as ProductSalesReport, range)
        break
      case 'category-sales':
        buildCategorySalesPdf(doc, data as CategorySalesReport, range)
        break
      case 'tax-summary':
        buildTaxReportPdf(doc, data as TaxReport, range)
        break
      case 'comparison':
        buildComparisonPdf(doc, data as ComparisonReport, range)
        break
    }

    doc.end()
  })
}

function salesSummaryCsv(data: SalesSummaryReport): string {
  const lines: string[] = []
  lines.push('Metric,Value')
  lines.push(`Gross Sales,${data.gross_sales}`)
  lines.push(`Tax Collected,${data.tax_collected}`)
  lines.push(`Net Sales,${data.net_sales}`)
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
  lines.push('Date,Transaction Count,Gross Sales,Tax Collected,Net Sales')
  for (const row of data.sales_by_day) {
    lines.push(
      `${row.date},${row.transaction_count},${row.gross_sales},${row.tax_collected},${row.net_sales}`
    )
  }
  return lines.join('\n')
}

function productSalesCsv(data: ProductSalesReport): string {
  const lines: string[] = []
  lines.push('Product,SKU,Item Type,Qty Sold,Revenue,Cost,Profit,Margin %')
  for (const item of data.items) {
    const name = `"${item.product_name.replace(/"/g, '""')}"`
    lines.push(
      `${name},${item.sku},${item.item_type ?? ''},${item.quantity_sold},${item.revenue},${item.cost_total},${item.profit},${item.margin_pct}`
    )
  }
  return lines.join('\n')
}

function categorySalesCsv(data: CategorySalesReport): string {
  const lines: string[] = []
  lines.push('Category,Transaction Count,Qty Sold,Revenue,Profit')
  for (const cat of data.categories) {
    lines.push(
      `${cat.item_type},${cat.transaction_count},${cat.quantity_sold},${cat.revenue},${cat.profit}`
    )
  }
  return lines.join('\n')
}

function taxReportCsv(data: TaxReport): string {
  const lines: string[] = []
  lines.push('Tax Code,Tax Rate %,Taxable Sales,Tax Collected')
  for (const row of data.tax_rows) {
    lines.push(`${row.tax_code_name},${row.tax_rate},${row.taxable_sales},${row.tax_collected}`)
  }
  return lines.join('\n')
}

function comparisonCsv(data: ComparisonReport): string {
  const lines: string[] = []
  lines.push('Field,Period A,Period B,Diff,Change %')
  for (const d of data.deltas) {
    lines.push(`${d.field},${d.period_a_value},${d.period_b_value},${d.diff},${d.change_pct}`)
  }
  return lines.join('\n')
}

function toCsv(data: ReportData, reportType: ReportType): string {
  switch (reportType) {
    case 'sales-summary':
      return salesSummaryCsv(data as SalesSummaryReport)
    case 'product-sales':
      return productSalesCsv(data as ProductSalesReport)
    case 'category-sales':
      return categorySalesCsv(data as CategorySalesReport)
    case 'tax-summary':
      return taxReportCsv(data as TaxReport)
    case 'comparison':
      return comparisonCsv(data as ComparisonReport)
  }
}

export async function exportToCsv(
  data: ReportData,
  reportType: ReportType,
  range: ReportDateRange
): Promise<string | null> {
  void range // included for API consistency
  const result = await dialog.showSaveDialog({
    title: 'Save Report as CSV',
    defaultPath: `${reportType}-report.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  })

  if (result.canceled || !result.filePath) return null

  const csv = toCsv(data, reportType)
  writeFileSync(result.filePath, csv, 'utf-8')
  return result.filePath
}
