import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { AppModalHeader } from '@renderer/components/common/AppModalHeader'
import { ReportsIcon } from '@renderer/components/common/modal-icons'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { AppButton } from '@renderer/components/common/AppButton'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { formatCurrency, formatInteger } from '@renderer/utils/currency'
import { ReportDateRangePicker } from './ReportDateRangePicker'
import { computeRange } from './report-date-utils'
import { ReportSummaryCard } from './ReportSummaryCard'
import { SalesLineChart } from './charts/SalesLineChart'
import { PaymentPieChart } from './charts/PaymentPieChart'
import { CardTypePieChart } from './charts/CardTypePieChart'
import { ProductBarChart } from './charts/ProductBarChart'
import { CategoryBarChart } from './charts/CategoryBarChart'
import { ComparisonBarChart } from './charts/ComparisonBarChart'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useReportsPrefsStore } from '@renderer/store/useReportsPrefsStore'
import type {
  ReportDateRange,
  ReportExportRequest,
  SalesSummaryReport,
  ProductSalesReport,
  CategorySalesReport,
  TaxReport,
  DeviceConfig,
  MerchantConfig,
  LocalTransactionHistoryStats,
  TransactionBackfillStatus
} from '../../../../shared/types'
import './reports-modal.css'

const MAX_BACKFILL_DAYS = 365

type ReportsModalProps = {
  isOpen: boolean
  onClose: () => void
}

type ComparisonGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year'

type YearComparisonRow = {
  label: string
  lastYearSales: number
  thisYearSales: number | null
}

function formatHistoryDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatHistoryRelative(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function getWeekNumberFromYearStart(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1)
  const dayMs = 24 * 60 * 60 * 1000
  return Math.floor((date.getTime() - start.getTime()) / dayMs / 7) + 1
}

function getBucketInfo(
  date: Date,
  granularity: ComparisonGranularity
): { key: string; label: string } {
  const month = date.getMonth()
  const day = date.getDate()

  switch (granularity) {
    case 'day': {
      const key = `D${String(month + 1).padStart(2, '0')}${String(day).padStart(2, '0')}`
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { key, label }
    }
    case 'week': {
      const week = getWeekNumberFromYearStart(date)
      return { key: `W${week}`, label: `Week ${week}` }
    }
    case 'month': {
      return {
        key: `M${month + 1}`,
        label: date.toLocaleDateString('en-US', { month: 'short' })
      }
    }
    case 'quarter': {
      const quarter = Math.floor(month / 3) + 1
      return { key: `Q${quarter}`, label: `Q${quarter}` }
    }
    case 'year':
      return { key: 'Y', label: 'Year Total' }
  }
}

function getBucketsForLastYear(
  granularity: ComparisonGranularity,
  now: Date
): Array<{ key: string; label: string }> {
  if (granularity === 'month') {
    return Array.from({ length: 12 }, (_, idx) => ({
      key: `M${idx + 1}`,
      label: new Date(now.getFullYear() - 1, idx, 1).toLocaleDateString('en-US', { month: 'short' })
    }))
  }

  if (granularity === 'quarter') {
    return ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({ key: q, label: q }))
  }

  if (granularity === 'year') {
    return [{ key: 'Y', label: 'Year Total' }]
  }

  const bucketMap = new Map<string, string>()
  const start = new Date(now.getFullYear() - 1, 0, 1)
  const end = new Date(now.getFullYear() - 1, 11, 31)

  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const { key, label } = getBucketInfo(current, granularity)
    if (!bucketMap.has(key)) {
      bucketMap.set(key, label)
    }
  }

  return Array.from(bucketMap.entries()).map(([key, label]) => ({ key, label }))
}

function aggregateGrossSalesByBucket(
  salesByDay: SalesSummaryReport['sales_by_day'],
  granularity: ComparisonGranularity
): Map<string, number> {
  const aggregates = new Map<string, number>()

  for (const row of salesByDay) {
    const date = toDateOnly(row.date)
    const { key } = getBucketInfo(date, granularity)
    const running = aggregates.get(key) ?? 0
    aggregates.set(key, running + row.gross_sales)
  }

  return aggregates
}

function getElapsedBucketSet(granularity: ComparisonGranularity, now: Date): Set<string> {
  const keys = new Set<string>()
  const start = new Date(now.getFullYear(), 0, 1)

  for (let current = new Date(start); current <= now; current.setDate(current.getDate() + 1)) {
    keys.add(getBucketInfo(current, granularity).key)
  }

  return keys
}

function buildYearComparisonRows(
  granularity: ComparisonGranularity,
  now: Date,
  lastYearSalesByDay: SalesSummaryReport['sales_by_day'],
  thisYearSalesByDay: SalesSummaryReport['sales_by_day']
): YearComparisonRow[] {
  const buckets = getBucketsForLastYear(granularity, now)
  const lastYearMap = aggregateGrossSalesByBucket(lastYearSalesByDay, granularity)
  const thisYearMap = aggregateGrossSalesByBucket(thisYearSalesByDay, granularity)
  const elapsedBucketSet = getElapsedBucketSet(granularity, now)

  return buckets.map(({ key, label }) => ({
    label,
    lastYearSales: lastYearMap.get(key) ?? 0,
    thisYearSales: elapsedBucketSet.has(key) ? (thisYearMap.get(key) ?? 0) : null
  }))
}

export function ReportsModal({ isOpen, onClose }: ReportsModalProps): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const [activeTab, setActiveTab] = useState('summary')
  const [range, setRange] = useState<ReportDateRange>(() => computeRange('this-month'))
  const [loading, setLoading] = useState(false)
  const [deviceConfig, setDeviceConfig] = useState<DeviceConfig | null>(null)
  const [merchantConfig, setMerchantConfig] = useState<MerchantConfig | null>(null)
  const [historyStats, setHistoryStats] = useState<LocalTransactionHistoryStats | null>(null)
  const [historyStatus, setHistoryStatus] = useState<TransactionBackfillStatus | null>(null)
  const [historyDaysInput, setHistoryDaysInput] = useState('30')
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyNotice, setHistoryNotice] = useState<string | null>(null)
  const [comparisonGranularity, setComparisonGranularity] = useState<ComparisonGranularity>('month')
  const [comparisonRows, setComparisonRows] = useState<YearComparisonRow[]>([])

  const { isRegisterScoped, setRegisterScoped } = useReportsPrefsStore()
  const registerScoped = isRegisterScoped(deviceConfig?.device_id)

  const [summary, setSummary] = useState<SalesSummaryReport | null>(null)
  const [productReport, setProductReport] = useState<ProductSalesReport | null>(null)
  const [categoryReport, setCategoryReport] = useState<CategorySalesReport | null>(null)
  const [taxReport, setTaxReport] = useState<TaxReport | null>(null)
  const [exportReportType, setExportReportType] =
    useState<ReportExportRequest['report_type']>('sales-summary')

  const getScopedRange = useCallback(
    (dateRange: ReportDateRange): ReportDateRange => {
      if (registerScoped && deviceConfig?.device_id) {
        return { ...dateRange, deviceId: deviceConfig.device_id }
      }
      return dateRange
    },
    [registerScoped, deviceConfig]
  )

  const loadHistoryMeta = useCallback(async () => {
    if (!api?.getLocalHistoryStats || !api.getBackfillStatus) return
    const [stats, backfill] = await Promise.all([
      api.getLocalHistoryStats(),
      api.getBackfillStatus()
    ])
    setHistoryStats(stats)
    setHistoryStatus(backfill)
  }, [api])

  useEffect(() => {
    if (isOpen && (!deviceConfig || !merchantConfig)) {
      void Promise.all([
        api?.getDeviceConfig?.() ?? Promise.resolve(null),
        api?.getMerchantConfig?.() ?? Promise.resolve(null)
      ]).then(([cfg, merchant]) => {
        if (cfg) setDeviceConfig(cfg)
        if (merchant) setMerchantConfig(merchant)
      })
    }
  }, [api, isOpen, deviceConfig, merchantConfig])

  useEffect(() => {
    if (!isOpen) return
    void loadHistoryMeta().catch((err) => {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load sales history status')
    })
  }, [isOpen, loadHistoryMeta])

  useEffect(() => {
    if (!isOpen || !api?.onBackfillStatusChanged) return
    const dispose = api.onBackfillStatusChanged((status) => {
      setHistoryStatus(status)
      if (status.state === 'done') {
        setHistoryNotice(`Sales history pull complete for the last ${status.days} days.`)
        setHistoryError(null)
        void api
          .getLocalHistoryStats?.()
          .then((stats) => {
            if (stats) setHistoryStats(stats)
          })
          .catch(() => {})
      }
      if (status.state === 'failed') {
        setHistoryError(status.lastError ?? 'Sales history pull failed')
      }
    })
    return dispose
  }, [api, isOpen])

  const loadTabData = useCallback(
    async (tab: string, dateRange: ReportDateRange) => {
      const scopedRange = getScopedRange(dateRange)
      setLoading(true)
      try {
        switch (tab) {
          case 'summary': {
            const data = await window.api?.getReportSalesSummary?.(scopedRange)
            if (data) setSummary(data)
            break
          }
          case 'products': {
            const [prod, cat] = await Promise.all([
              window.api?.getReportProductSales?.(scopedRange, 'revenue', 20),
              window.api?.getReportCategorySales?.(scopedRange)
            ])
            if (prod) setProductReport(prod)
            if (cat) setCategoryReport(cat)
            break
          }
          case 'tax': {
            const data = await window.api?.getReportTaxSummary?.(scopedRange)
            if (data) setTaxReport(data)
            break
          }
          case 'comparison': {
            const now = new Date()
            const thisYearRange = getScopedRange({
              from: new Date(now.getFullYear(), 0, 1).toISOString(),
              to: new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                23,
                59,
                59
              ).toISOString(),
              preset: 'this-year'
            })
            const lastYearRange = getScopedRange({
              from: new Date(now.getFullYear() - 1, 0, 1).toISOString(),
              to: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59).toISOString(),
              preset: 'last-year'
            })

            const [lastYearSummary, thisYearSummary] = await Promise.all([
              window.api?.getReportSalesSummary?.(lastYearRange),
              window.api?.getReportSalesSummary?.(thisYearRange)
            ])

            if (lastYearSummary && thisYearSummary) {
              setComparisonRows(
                buildYearComparisonRows(
                  comparisonGranularity,
                  now,
                  lastYearSummary.sales_by_day,
                  thisYearSummary.sales_by_day
                )
              )
            }
            break
          }
        }
      } catch (err) {
        console.error('Failed to load report data:', err)
      } finally {
        setLoading(false)
      }
    },
    [comparisonGranularity, getScopedRange]
  )

  useEffect(() => {
    if (isOpen) {
      void loadTabData(activeTab, range)
    }
  }, [isOpen, activeTab, range, loadTabData, registerScoped, comparisonGranularity])

  useEffect(() => {
    if (activeTab === 'summary') setExportReportType('sales-summary')
    if (activeTab === 'products') setExportReportType('product-sales')
    if (activeTab === 'tax') setExportReportType('tax-summary')
  }, [activeTab])

  const handleExport = useCallback(
    async (format: 'pdf' | 'csv') => {
      try {
        const scopedRange = getScopedRange(range)
        await window.api?.exportReport?.({
          report_type: exportReportType,
          date_range: scopedRange,
          format,
          metadata: {
            store_name: merchantConfig?.store_name ?? merchantConfig?.merchant_name,
            merchant_name: merchantConfig?.merchant_name,
            merchant_id: merchantConfig?.merchant_id
          }
        })
      } catch (err) {
        console.error('Export failed:', err)
      }
    },
    [exportReportType, getScopedRange, merchantConfig, range]
  )

  const handlePullSalesHistory = useCallback(async () => {
    if (!api?.triggerBackfill) return
    const days = Number(historyDaysInput)

    if (!Number.isFinite(days) || days <= 0) {
      setHistoryError('Enter a positive number of days')
      return
    }

    if (days > MAX_BACKFILL_DAYS) {
      setHistoryError(`Sales history pull is limited to ${MAX_BACKFILL_DAYS} days per request`)
      return
    }

    try {
      setHistoryError(null)
      setHistoryNotice(null)
      await api.triggerBackfill(days)
      setHistoryNotice(`Started pulling sales history for the last ${days} days.`)
      await loadHistoryMeta()
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to start sales history pull')
    }
  }, [api, historyDaysInput, loadHistoryMeta])

  const distributorCount = new Set(
    productReport?.items
      .map((item) => item.distributor_name?.trim())
      .filter((name): name is string => Boolean(name)) ?? []
  ).size

  const comparisonTitle = useMemo(() => {
    if (comparisonGranularity === 'day') return 'This Year vs Last Year by Day'
    if (comparisonGranularity === 'week') return 'This Year vs Last Year by Week'
    if (comparisonGranularity === 'month') return 'This Year vs Last Year by Month'
    if (comparisonGranularity === 'quarter') return 'This Year vs Last Year by Quarter'
    return 'This Year vs Last Year'
  }, [comparisonGranularity])

  const comparisonThisYearTotal = comparisonRows.reduce(
    (sum, row) => sum + (row.thisYearSales ?? 0),
    0
  )
  const comparisonLastYearTotal = comparisonRows.reduce((sum, row) => sum + row.lastYearSales, 0)
  const historyRunning = historyStatus?.state === 'running'
  const historyStatusText =
    historyStatus?.state === 'running'
      ? `Pulling last ${historyStatus.days} days: ${formatInteger(historyStatus.applied)} applied, ${formatInteger(historyStatus.skipped)} already local`
      : historyStatus?.state === 'done'
        ? `Last pull complete${historyStatus.finishedAt ? ` ${formatHistoryRelative(historyStatus.finishedAt)}` : ''}: ${formatInteger(historyStatus.applied)} applied`
        : historyStatus?.state === 'failed'
          ? (historyStatus.lastError ?? 'Last pull failed')
          : 'Sales history no longer downloads automatically at sign-in.'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="reports-modal"
        aria-describedby={undefined}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="dialog__sr-only">Reports</DialogTitle>
        <AppModalHeader
          icon={<ReportsIcon />}
          label="Reports"
          title="Sales Reports"
          onClose={onClose}
        />

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="reports-modal__tabs app-modal-tabs"
        >
          <div className="app-modal-tabs__bar">
            <TabsList className="app-modal-tabs__list">
              <TabsTrigger value="summary" className="app-modal-tabs__trigger">
                Sales Summary
              </TabsTrigger>
              <TabsTrigger value="products" className="app-modal-tabs__trigger">
                Product Analysis
              </TabsTrigger>
              <TabsTrigger value="tax" className="app-modal-tabs__trigger">
                Tax Report
              </TabsTrigger>
              <TabsTrigger value="comparison" className="app-modal-tabs__trigger">
                Comparisons
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="reports-modal__date-bar">
            {activeTab !== 'comparison' && (
              <ReportDateRangePicker value={range} onChange={setRange} />
            )}
            {activeTab !== 'comparison' && (
              <div className="reports-modal__date-bar-actions">
                {deviceConfig && (
                  <button
                    type="button"
                    className={`reports-modal__register-toggle${registerScoped ? ' reports-modal__register-toggle--active' : ''}`}
                    onClick={() => setRegisterScoped(deviceConfig.device_id, !registerScoped)}
                    title={
                      registerScoped
                        ? 'Showing data for this register only — click to show all registers'
                        : 'Showing all registers — click to filter to this register only'
                    }
                  >
                    {registerScoped ? 'This register only' : 'All registers'}
                  </button>
                )}
                <div className="reports-modal__export-btns">
                  <label className="reports-modal__export-type-label" htmlFor="report-export-type">
                    Export
                  </label>
                  <select
                    id="report-export-type"
                    className="reports-modal__export-type-select"
                    value={exportReportType}
                    onChange={(e) =>
                      setExportReportType(e.target.value as ReportExportRequest['report_type'])
                    }
                  >
                    <option value="sales-summary">Sales Summary</option>
                    <option value="product-sales">Product Sales</option>
                    <option value="category-sales">Category Sales</option>
                    <option value="tax-summary">Tax Summary</option>
                    <option value="transaction-list">All Transactions</option>
                  </select>
                  <AppButton variant="neutral" size="sm" onClick={() => void handleExport('pdf')}>
                    Download PDF
                  </AppButton>
                  <AppButton variant="neutral" size="sm" onClick={() => void handleExport('csv')}>
                    Download CSV
                  </AppButton>
                </div>
              </div>
            )}
            {activeTab === 'comparison' && (
              <div className="reports-modal__comparison-controls">
                {deviceConfig && (
                  <button
                    type="button"
                    className={`reports-modal__register-toggle${registerScoped ? ' reports-modal__register-toggle--active' : ''}`}
                    onClick={() => setRegisterScoped(deviceConfig.device_id, !registerScoped)}
                    title={
                      registerScoped
                        ? 'Showing data for this register only — click to show all registers'
                        : 'Showing all registers — click to filter to this register only'
                    }
                  >
                    {registerScoped ? 'This register only' : 'All registers'}
                  </button>
                )}

                <div className="reports-modal__comparison-granularity">
                  <span className="reports-modal__range-label">Group By</span>
                  <ToggleGroup
                    type="single"
                    value={comparisonGranularity}
                    onValueChange={(value) => {
                      if (value) {
                        setComparisonGranularity(value as ComparisonGranularity)
                      }
                    }}
                    className="reports-modal__comparison-toggle"
                  >
                    <ToggleGroupItem value="day" aria-label="Group by day">
                      Day
                    </ToggleGroupItem>
                    <ToggleGroupItem value="week" aria-label="Group by week">
                      Week
                    </ToggleGroupItem>
                    <ToggleGroupItem value="month" aria-label="Group by month">
                      Month
                    </ToggleGroupItem>
                    <ToggleGroupItem value="quarter" aria-label="Group by quarter">
                      Quarter
                    </ToggleGroupItem>
                    <ToggleGroupItem value="year" aria-label="Group by year">
                      Year
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            )}
          </div>

          <div className="reports-modal__history-panel" data-testid="reports-history-panel">
            <div className="reports-modal__history-copy">
              <span className="reports-modal__history-title">Pull sales history from cloud</span>
              <span className="reports-modal__history-meta">
                {historyStats
                  ? `${formatInteger(historyStats.count)} local transactions • earliest ${formatHistoryDate(historyStats.earliest)}`
                  : 'Loading local sales history coverage...'}
              </span>
              <span className="reports-modal__history-meta">{historyStatusText}</span>
              {historyNotice ? (
                <span className="reports-modal__history-notice">{historyNotice}</span>
              ) : null}
              {historyError ? (
                <span className="reports-modal__history-error">{historyError}</span>
              ) : null}
            </div>

            <div className="reports-modal__history-actions">
              <label className="reports-modal__history-label" htmlFor="reports-history-days">
                Days
              </label>
              <ValidatedInput
                id="reports-history-days"
                fieldType="integer"
                value={historyDaysInput}
                onChange={setHistoryDaysInput}
                className="reports-modal__history-input"
                disabled={historyRunning}
                aria-label="Days of sales history to pull"
              />
              <AppButton
                variant="neutral"
                size="sm"
                onClick={() => void handlePullSalesHistory()}
                disabled={historyRunning || !api?.triggerBackfill}
              >
                {historyRunning ? 'Pulling...' : 'Pull Sales History'}
              </AppButton>
            </div>
          </div>

          {loading && <div className="reports-modal__loading">Loading report data...</div>}

          <TabsContent value="summary" className="reports-modal__content app-modal-tabs__content">
            {summary && (
              <>
                <div className="reports-modal__meta-bar">
                  <div className="reports-modal__meta-item">
                    Store:{' '}
                    {merchantConfig?.store_name ?? merchantConfig?.merchant_name ?? 'Unknown'}
                  </div>
                  <div className="reports-modal__meta-item">
                    Merchant: {merchantConfig?.merchant_name ?? 'Unknown'}
                  </div>
                  <div className="reports-modal__meta-item">
                    Finix Merchant ID: {merchantConfig?.merchant_id ?? 'Unknown'}
                  </div>
                </div>

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

                <div className="reports-modal__chart-panel reports-modal__chart-panel--full-width">
                  <h3 className="reports-modal__chart-title">Daily Sales Trend</h3>
                  <div className="reports-modal__chart-body">
                    {summary.sales_by_day.length > 0 ? (
                      <SalesLineChart data={summary.sales_by_day} />
                    ) : (
                      <p className="reports-modal__empty">No data for selected period</p>
                    )}
                  </div>
                </div>

                <div className="reports-modal__charts reports-modal__charts--balanced">
                  <div className="reports-modal__chart-panel reports-modal__chart-panel--small">
                    <h3 className="reports-modal__chart-title">Payment Methods</h3>
                    <div className="reports-modal__chart-body">
                      {summary.sales_by_payment.length > 0 ? (
                        <PaymentPieChart data={summary.sales_by_payment} />
                      ) : (
                        <p className="reports-modal__empty">No data for selected period</p>
                      )}
                    </div>
                  </div>

                  <div className="reports-modal__chart-panel reports-modal__chart-panel--small">
                    <h3 className="reports-modal__chart-title">Card Type Breakdown</h3>
                    <div className="reports-modal__chart-body">
                      {summary.sales_by_card_brand.length > 0 ? (
                        <CardTypePieChart data={summary.sales_by_card_brand} />
                      ) : (
                        <p className="reports-modal__empty">No card data for selected period</p>
                      )}
                    </div>
                  </div>
                </div>

                {summary.sales_by_account_service.length > 0 && (
                  <div
                    className="reports-modal__chart-panel reports-modal__chart-panel--full-width"
                    data-testid="account-service-breakdown"
                  >
                    <h3 className="reports-modal__chart-title">Account Sales by Service</h3>
                    <div className="reports-modal__chart-body">
                      <table className="reports-modal__table">
                        <thead>
                          <tr>
                            <th>Service</th>
                            <th className="reports-modal__table-num">Transactions</th>
                            <th className="reports-modal__table-num">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.sales_by_account_service.map((row) => (
                            <tr key={row.service_name}>
                              <td>{row.service_name}</td>
                              <td className="reports-modal__table-num">
                                {formatInteger(row.transaction_count)}
                              </td>
                              <td className="reports-modal__table-num">
                                {formatCurrency(row.total_amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {summary.refund_count > 0 && (
                  <div className="reports-modal__refund-summary">
                    Refunds: {formatInteger(summary.refund_count)} totaling{' '}
                    {formatCurrency(summary.refund_amount)}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="products" className="reports-modal__content app-modal-tabs__content">
            {productReport && (
              <>
                <div className="reports-modal__cards reports-modal__cards--products">
                  <ReportSummaryCard
                    label="Products"
                    value={productReport.items.length}
                    isCurrency={false}
                  />
                  <ReportSummaryCard
                    label="Distributors"
                    value={distributorCount}
                    isCurrency={false}
                  />
                </div>

                <div className="reports-modal__chart-panel">
                  <h3 className="reports-modal__chart-title">Top Products by Revenue</h3>
                  <div className="reports-modal__chart-body">
                    {productReport.items.length > 0 ? (
                      <ProductBarChart data={productReport.items.slice(0, 20)} />
                    ) : (
                      <p className="reports-modal__empty">No product data for selected period</p>
                    )}
                  </div>
                </div>

                {categoryReport && categoryReport.categories.length > 0 && (
                  <>
                    <div className="reports-modal__chart-panel">
                      <h3 className="reports-modal__chart-title">Sales by Category</h3>
                      <div className="reports-modal__chart-body">
                        <CategoryBarChart data={categoryReport.categories} />
                      </div>
                    </div>

                    <div className="reports-modal__table-wrap">
                      <table className="reports-modal__table">
                        <thead>
                          <tr>
                            <th>Category</th>
                            <th>Transactions</th>
                            <th>Qty</th>
                            <th>Revenue</th>
                            <th>Profit</th>
                            <th>Profit %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryReport.categories.map((category) => (
                            <tr key={category.item_type}>
                              <td>{category.item_type}</td>
                              <td>{formatInteger(category.transaction_count)}</td>
                              <td>{formatInteger(category.quantity_sold)}</td>
                              <td>{formatCurrency(category.revenue)}</td>
                              <td>{formatCurrency(category.profit)}</td>
                              <td>{category.profit_margin_pct.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {productReport.items.length > 0 && (
                  <div className="reports-modal__table-wrap">
                    <table className="reports-modal__table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Distributor</th>
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
                            <td>{item.distributor_name ?? 'Unassigned'}</td>
                            <td>{item.sku}</td>
                            <td>{item.item_type ?? '-'}</td>
                            <td>{formatInteger(item.quantity_sold)}</td>
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

          <TabsContent value="tax" className="reports-modal__content app-modal-tabs__content">
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

          <TabsContent
            value="comparison"
            className="reports-modal__content app-modal-tabs__content"
          >
            {comparisonRows.length > 0 && (
              <>
                <div className="reports-modal__cards reports-modal__cards--products">
                  <ReportSummaryCard label="Last Year Sales" value={comparisonLastYearTotal} />
                  <ReportSummaryCard
                    label="This Year Sales (YTD)"
                    value={comparisonThisYearTotal}
                  />
                </div>

                <div className="reports-modal__chart-panel">
                  <h3 className="reports-modal__chart-title">{comparisonTitle}</h3>
                  <div className="reports-modal__chart-body">
                    <ComparisonBarChart
                      points={comparisonRows.map((row) => ({
                        label: row.label,
                        valueA: row.lastYearSales,
                        valueB: row.thisYearSales
                      }))}
                      labelA="Last Year"
                      labelB="This Year (YTD)"
                    />
                  </div>
                </div>

                <div className="reports-modal__table-wrap">
                  <table className="reports-modal__table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Last Year</th>
                        <th>This Year (YTD)</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row) => {
                        const changePct =
                          row.thisYearSales === null || row.lastYearSales === 0
                            ? null
                            : (
                                ((row.thisYearSales - row.lastYearSales) / row.lastYearSales) *
                                100
                              ).toFixed(1)

                        return (
                          <tr key={row.label}>
                            <td>{row.label}</td>
                            <td>{formatCurrency(row.lastYearSales)}</td>
                            <td>
                              {row.thisYearSales === null ? '—' : formatCurrency(row.thisYearSales)}
                            </td>
                            <td
                              className={
                                typeof changePct === 'string' && Number(changePct) > 0
                                  ? 'reports-modal__positive'
                                  : typeof changePct === 'string' && Number(changePct) < 0
                                    ? 'reports-modal__negative'
                                    : ''
                              }
                            >
                              {changePct === null
                                ? '—'
                                : `${Number(changePct) > 0 ? '+' : ''}${changePct}%`}
                            </td>
                          </tr>
                        )
                      })}
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
