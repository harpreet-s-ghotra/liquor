import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { AppButton } from '@renderer/components/common/AppButton'
import { formatCurrency } from '@renderer/utils/currency'
import { ReportDateRangePicker } from './ReportDateRangePicker'
import { computeRange } from './report-date-utils'
import { ReportSummaryCard } from './ReportSummaryCard'
import { SalesLineChart } from './charts/SalesLineChart'
import { PaymentPieChart } from './charts/PaymentPieChart'
import { ProductBarChart } from './charts/ProductBarChart'
import { CategoryBarChart } from './charts/CategoryBarChart'
import { ComparisonBarChart } from './charts/ComparisonBarChart'
import { useState, useEffect, useCallback } from 'react'
import type {
  ReportDateRange,
  SalesSummaryReport,
  ProductSalesReport,
  CategorySalesReport,
  TaxReport,
  ComparisonReport
} from '../../../../shared/types'
import './reports-modal.css'

type ReportsModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function ReportsModal({ isOpen, onClose }: ReportsModalProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('summary')
  const [range, setRange] = useState<ReportDateRange>(() => computeRange('this-month'))
  const [rangeA, setRangeA] = useState<ReportDateRange>(() => computeRange('last-month'))
  const [rangeB, setRangeB] = useState<ReportDateRange>(() => computeRange('this-month'))
  const [loading, setLoading] = useState(false)

  const [summary, setSummary] = useState<SalesSummaryReport | null>(null)
  const [productReport, setProductReport] = useState<ProductSalesReport | null>(null)
  const [categoryReport, setCategoryReport] = useState<CategorySalesReport | null>(null)
  const [taxReport, setTaxReport] = useState<TaxReport | null>(null)
  const [comparison, setComparison] = useState<ComparisonReport | null>(null)

  const loadTabData = useCallback(
    async (tab: string, dateRange: ReportDateRange) => {
      setLoading(true)
      try {
        switch (tab) {
          case 'summary': {
            const data = await window.api?.getReportSalesSummary?.(dateRange)
            if (data) setSummary(data)
            break
          }
          case 'products': {
            const [prod, cat] = await Promise.all([
              window.api?.getReportProductSales?.(dateRange, 'revenue', 20),
              window.api?.getReportCategorySales?.(dateRange)
            ])
            if (prod) setProductReport(prod)
            if (cat) setCategoryReport(cat)
            break
          }
          case 'tax': {
            const data = await window.api?.getReportTaxSummary?.(dateRange)
            if (data) setTaxReport(data)
            break
          }
          case 'comparison': {
            const data = await window.api?.getReportComparison?.(rangeA, rangeB)
            if (data) setComparison(data)
            break
          }
        }
      } catch (err) {
        console.error('Failed to load report data:', err)
      } finally {
        setLoading(false)
      }
    },
    [rangeA, rangeB]
  )

  useEffect(() => {
    if (isOpen) {
      void loadTabData(activeTab, range)
    }
  }, [isOpen, activeTab, range, loadTabData])

  const handleExport = useCallback(
    async (format: 'pdf' | 'csv') => {
      const reportTypeMap: Record<string, string> = {
        summary: 'sales-summary',
        products: 'product-sales',
        tax: 'tax-summary'
      }
      const reportType = reportTypeMap[activeTab]
      if (!reportType) return
      try {
        await window.api?.exportReport?.({
          report_type: reportType as 'sales-summary' | 'product-sales' | 'tax-summary',
          date_range: range,
          format
        })
      } catch (err) {
        console.error('Export failed:', err)
      }
    },
    [activeTab, range]
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="reports-modal"
        aria-describedby={undefined}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Sales Reports</DialogTitle>
          <button type="button" className="reports-modal__close-btn" onClick={onClose}>
            Close
          </button>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="reports-modal__tabs">
          <TabsList>
            <TabsTrigger value="summary">Sales Summary</TabsTrigger>
            <TabsTrigger value="products">Product Analysis</TabsTrigger>
            <TabsTrigger value="tax">Tax Report</TabsTrigger>
            <TabsTrigger value="comparison">Comparisons</TabsTrigger>
          </TabsList>

          <div className="reports-modal__date-bar">
            {activeTab !== 'comparison' ? (
              <ReportDateRangePicker value={range} onChange={setRange} />
            ) : (
              <div className="reports-modal__comparison-ranges">
                <div>
                  <span className="reports-modal__range-label">Period A</span>
                  <ReportDateRangePicker value={rangeA} onChange={setRangeA} />
                </div>
                <div>
                  <span className="reports-modal__range-label">Period B</span>
                  <ReportDateRangePicker value={rangeB} onChange={setRangeB} />
                </div>
                <AppButton
                  variant="default"
                  size="sm"
                  onClick={() => void loadTabData('comparison', range)}
                >
                  Compare
                </AppButton>
              </div>
            )}
            {activeTab !== 'comparison' && (
              <div className="reports-modal__export-btns">
                <AppButton variant="neutral" size="sm" onClick={() => void handleExport('pdf')}>
                  Download PDF
                </AppButton>
                <AppButton variant="neutral" size="sm" onClick={() => void handleExport('csv')}>
                  Download CSV
                </AppButton>
              </div>
            )}
          </div>

          {loading && <div className="reports-modal__loading">Loading report data...</div>}

          <TabsContent value="summary" className="reports-modal__content">
            {summary && (
              <>
                <div className="reports-modal__cards">
                  <ReportSummaryCard label="Gross Sales" value={summary.gross_sales} />
                  <ReportSummaryCard label="Net Sales" value={summary.net_sales} />
                  <ReportSummaryCard label="Tax Collected" value={summary.tax_collected} />
                  <ReportSummaryCard
                    label="Transactions"
                    value={summary.transaction_count}
                    isCurrency={false}
                  />
                  <ReportSummaryCard label="Avg Transaction" value={summary.avg_transaction} />
                </div>

                <div className="reports-modal__charts">
                  <div className="reports-modal__chart-panel">
                    <h3 className="reports-modal__chart-title">Daily Sales Trend</h3>
                    {summary.sales_by_day.length > 0 ? (
                      <SalesLineChart data={summary.sales_by_day} />
                    ) : (
                      <p className="reports-modal__empty">No data for selected period</p>
                    )}
                  </div>
                  <div className="reports-modal__chart-panel reports-modal__chart-panel--small">
                    <h3 className="reports-modal__chart-title">Payment Methods</h3>
                    {summary.sales_by_payment.length > 0 ? (
                      <PaymentPieChart data={summary.sales_by_payment} />
                    ) : (
                      <p className="reports-modal__empty">No data for selected period</p>
                    )}
                  </div>
                </div>

                {summary.refund_count > 0 && (
                  <div className="reports-modal__refund-summary">
                    Refunds: {summary.refund_count} totaling {formatCurrency(summary.refund_amount)}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="products" className="reports-modal__content">
            {productReport && (
              <>
                <div className="reports-modal__chart-panel">
                  <h3 className="reports-modal__chart-title">Top Products by Revenue</h3>
                  {productReport.items.length > 0 ? (
                    <ProductBarChart data={productReport.items.slice(0, 20)} />
                  ) : (
                    <p className="reports-modal__empty">No product data for selected period</p>
                  )}
                </div>

                {categoryReport && categoryReport.categories.length > 0 && (
                  <div className="reports-modal__chart-panel">
                    <h3 className="reports-modal__chart-title">Sales by Category</h3>
                    <CategoryBarChart data={categoryReport.categories} />
                  </div>
                )}

                {productReport.items.length > 0 && (
                  <div className="reports-modal__table-wrap">
                    <table className="reports-modal__table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>SKU</th>
                          <th>Type</th>
                          <th>Qty</th>
                          <th>Revenue</th>
                          <th>Profit</th>
                          <th>Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productReport.items.map((item) => (
                          <tr key={item.product_id}>
                            <td>{item.product_name}</td>
                            <td>{item.sku}</td>
                            <td>{item.item_type ?? '-'}</td>
                            <td>{item.quantity_sold}</td>
                            <td>{formatCurrency(item.revenue)}</td>
                            <td>{formatCurrency(item.profit)}</td>
                            <td>{item.margin_pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="tax" className="reports-modal__content">
            {taxReport && (
              <>
                {taxReport.tax_rows.length > 0 ? (
                  <div className="reports-modal__table-wrap">
                    <table className="reports-modal__table">
                      <thead>
                        <tr>
                          <th>Tax Code</th>
                          <th>Rate</th>
                          <th>Taxable Sales</th>
                          <th>Tax Collected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taxReport.tax_rows.map((row) => (
                          <tr key={row.tax_code_name}>
                            <td>{row.tax_code_name}</td>
                            <td>{row.tax_rate}%</td>
                            <td>{formatCurrency(row.taxable_sales)}</td>
                            <td>{formatCurrency(row.tax_collected)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}>Total</td>
                          <td>
                            {formatCurrency(
                              taxReport.tax_rows.reduce((s, r) => s + r.taxable_sales, 0)
                            )}
                          </td>
                          <td>
                            {formatCurrency(
                              taxReport.tax_rows.reduce((s, r) => s + r.tax_collected, 0)
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="reports-modal__empty">No tax data for selected period</p>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="comparison" className="reports-modal__content">
            {comparison && (
              <>
                <div className="reports-modal__chart-panel">
                  <h3 className="reports-modal__chart-title">Period Comparison</h3>
                  <ComparisonBarChart deltas={comparison.deltas} />
                </div>

                <div className="reports-modal__table-wrap">
                  <table className="reports-modal__table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Period A</th>
                        <th>Period B</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.deltas.map((d) => (
                        <tr key={d.field}>
                          <td>{d.field}</td>
                          <td>{formatCurrency(d.period_a_value)}</td>
                          <td>{formatCurrency(d.period_b_value)}</td>
                          <td
                            className={
                              d.change_pct > 0
                                ? 'reports-modal__positive'
                                : d.change_pct < 0
                                  ? 'reports-modal__negative'
                                  : ''
                            }
                          >
                            {d.change_pct > 0 ? '+' : ''}
                            {d.change_pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
