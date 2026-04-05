## Plan: Sales Reporting Feature

### TL;DR

Add a full Sales Reporting module to LiquorPOS with interactive charts, comparison analytics, and downloadable reports for tax compliance. Uses **Chart.js + react-chartjs-2** for visualizations (67kB gzipped -- half the size of Recharts) and the existing **pdfkit** for PDF exports. Reports are powered by new SQLite aggregation queries in the main process, exposed via IPC, and rendered in a new `ReportsModal` in the renderer.

---

### Research Findings

#### NYS Legal Requirements (TB-ST-770)

Per NYS Tax Bulletin ST-770, POS vendors **must**:

- Keep records of **every sale**: item(s) sold, selling price, tax due, invoice/transaction number, date of sale, payment method, POS terminal number
- Retain records for **minimum 3 years** from due date of the return
- Maintain **audit trail** with sequential transaction numbers, void/cancellation tracking
- Produce **summary documents** that allow drill-down to underlying detail (invoices, vouchers)
- Make records available in **machine-readable/auditable form** upon request
- Separately state taxable vs non-taxable items and the sales tax amount
- Track **food stamp exempt** purchases separately (field already exists: `allow_food_stamps`)
- File **quarterly ST-100** returns showing: total sales, taxable sales, credits, sales & use taxes due per locality

**Key compliance takeaway:** The POS must be able to generate reports that show total sales, taxable sales, tax collected broken down by locality/code, and export raw transaction data for audit. The existing `transactions` table already stores all required fields.

#### Industry Standard POS Reports (Square, Lightspeed, Shopify POS, KORONA)

| Report                  | What It Shows                                        | Priority      |
| ----------------------- | ---------------------------------------------------- | ------------- |
| Sales Summary           | Gross sales, tax, net, refunds, avg transaction      | P0 (required) |
| Sales by Product        | Top sellers, revenue & qty per item                  | P0            |
| Sales by Category       | Revenue by item_type (Wine/Spirit/Beer)              | P0            |
| Sales by Payment Method | Cash/credit/debit breakdown                          | P0            |
| Tax Summary             | Tax collected by code, by period (for ST-100 filing) | P0 (legal)    |
| Sales Trends            | Time-series (daily/weekly/monthly/yearly)            | P0            |
| Period Comparison       | YoY, MoM, custom range vs range                      | P1            |
| Cashier Performance     | Sales per cashier, avg ticket                        | P1            |
| Profit & Margin         | Revenue vs COGS, margin % by product/category        | P1            |
| Hourly Sales            | Peak hour analysis                                   | P2            |

#### Charting Library Comparison

| Library                        | Gzipped Size      | React Support  | Rendering     | Deps            | Verdict              |
| ------------------------------ | ----------------- | -------------- | ------------- | --------------- | -------------------- |
| **chart.js + react-chartjs-2** | **67kB** (66 + 1) | Native wrapper | Canvas (fast) | 1               | **Recommended**      |
| recharts                       | 136kB             | Native         | SVG (slower)  | 11 (incl Redux) | Too heavy            |
| uplot                          | 21kB              | No wrapper     | Canvas        | 0               | No React integration |
| echarts                        | 353kB             | Needs wrapper  | Canvas        | Many            | Way too heavy        |

**Recommendation:** `chart.js` + `react-chartjs-2`. Half the size of Recharts, canvas-based for performance, tree-shakeable, well-maintained (31M weekly downloads). React wrapper is only 1kB.

#### Export Formats

| Format | Library                      | Use Case                                  |
| ------ | ---------------------------- | ----------------------------------------- |
| PDF    | `pdfkit` (already installed) | Formatted reports for printing/tax filing |
| CSV    | Built-in (no library needed) | Raw data export for accountants/auditors  |

---

### Existing Infrastructure to Reuse

- **`ClockOutReport`** in `sessions.repo.ts` -- aggregation query patterns (GROUP BY item_type, payment_method, SUM/COUNT)
- **`SalesHistoryModal`** -- date range presets, pagination, filter UI patterns
- **`TransactionListFilter`** type -- existing filter structure to extend
- **`formatCurrency()`** -- all monetary display
- **`Dialog` + `TabBar`** -- modal shell + tab navigation
- **`pdfkit`** -- PDF generation (already used for receipts)
- **Design tokens** -- `--bg-panel`, `--text-primary`, ledger table styles, etc.

---

### Architecture

```
ReportsModal (renderer)
  |-- Tab: Sales Summary
  |-- Tab: Product Analysis
  |-- Tab: Tax Report
  +-- Tab: Comparisons

Each tab calls window.api.reports:* IPC channels
  -> reports.repo.ts (new) -- SQLite aggregation queries
  -> Returns typed report data
  -> Chart.js renders visualizations
  -> Export button -> pdfkit (PDF) or built-in CSV generator (main process)
```

---

### Steps

#### Phase 1: Backend -- Report Repository & IPC (no UI dependencies)

1. **Add shared types** in `src/shared/types/index.ts`
   - `ReportDateRange { from: string; to: string; preset?: string }`
   - `SalesSummaryReport { gross_sales, tax_collected, net_sales, refund_count, refund_amount, transaction_count, avg_transaction, sales_by_payment: PaymentMethodSalesRow[], sales_by_day: DailySalesRow[] }`
   - `ProductSalesReport { items: ProductSalesRow[] }` where `ProductSalesRow { product_id, product_name, item_type, sku, quantity_sold, revenue, cost_total, profit, margin_pct }`
   - `CategorySalesReport { categories: CategorySalesRow[] }` where row has `item_type, transaction_count, quantity_sold, revenue, profit`
   - `TaxReport { tax_rows: TaxReportRow[] }` where row has `tax_code_name, tax_rate, taxable_sales, tax_collected, period`
   - `ComparisonReport { period_a: SalesSummaryReport, period_b: SalesSummaryReport, deltas: { field, change_pct, diff }[] }`
   - `ReportExportRequest { report_type, date_range, format: 'pdf' | 'csv' }`

2. **Create `src/main/database/reports.repo.ts`** -- new repo with pure SQL aggregation functions
   - `getSalesSummary(dateRange)` -- total/avg/count with GROUP BY date and payment_method. _Reference pattern:_ `generateClockOutReport()` in `sessions.repo.ts`
   - `getProductSales(dateRange, sortBy, limit)` -- JOIN `transaction_items` -> `products`, GROUP BY product_id
   - `getCategorySales(dateRange)` -- GROUP BY `products.item_type`
   - `getTaxSummary(dateRange)` -- GROUP BY tax code, calculate taxable sales and tax collected per code
   - `getComparisonData(rangeA, rangeB)` -- runs `getSalesSummary` for each range, calculates deltas
   - `getCashierSales(dateRange)` -- JOIN transactions -> sessions -> cashiers, GROUP BY cashier
   - `getHourlySales(dateRange)` -- GROUP BY `strftime('%H', created_at)`

3. **Create `src/main/services/report-export.ts`** -- export service (main process)
   - `exportToPdf(reportData, reportType)` -- uses `pdfkit` to generate formatted PDF with tables, header, date range, totals. _Reference:_ existing receipt PDF pattern
   - `exportToCsv(reportData, reportType)` -- simple CSV string builder (no library), uses Electron `dialog.showSaveDialog` to pick save location
   - Both return the saved file path

4. **Register IPC handlers** in `src/main/index.ts`
   - `reports:sales-summary` -> `getSalesSummary`
   - `reports:product-sales` -> `getProductSales`
   - `reports:category-sales` -> `getCategorySales`
   - `reports:tax-summary` -> `getTaxSummary`
   - `reports:comparison` -> `getComparisonData`
   - `reports:cashier-sales` -> `getCashierSales`
   - `reports:hourly-sales` -> `getHourlySales`
   - `reports:export` -> `exportToPdf` or `exportToCsv`

5. **Expose via preload** in `src/preload/index.ts` + `src/preload/index.d.ts`

#### Phase 2: Frontend -- Charts & Report UI (_depends on Phase 1_)

6. **Install chart.js + react-chartjs-2** -- `npm install chart.js react-chartjs-2`

7. **Create chart wrapper components** in `src/renderer/src/components/reports/charts/`
   - `SalesLineChart.tsx` -- time-series line chart (daily/weekly/monthly sales trends). Uses `Line` from react-chartjs-2
   - `PaymentPieChart.tsx` -- pie/doughnut chart for payment method breakdown. Uses `Doughnut`
   - `ProductBarChart.tsx` -- horizontal bar chart for top products. Uses `Bar`
   - `CategoryBarChart.tsx` -- bar chart for category breakdown. Uses `Bar`
   - `ComparisonBarChart.tsx` -- grouped bar chart (period A vs B side-by-side). Uses `Bar` with multiple datasets
   - All charts use design tokens for colors (map `--semantic-success-text`, `--accent-blue`, etc. to chart palette)
   - All charts respect "no animations" constraint (`animation: false` in Chart.js config)

8. **Create `ReportsModal.tsx`** in `src/renderer/src/components/reports/`
   - Modal shell using `Dialog` + `DialogContent`
   - 4 tabs using `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`:
     - **Sales Summary** -- date range picker (presets + custom), summary cards (gross, net, tax, avg, count), `SalesLineChart`, `PaymentPieChart`, summary table
     - **Product Analysis** -- `ProductBarChart` (top 20), sortable product table (by revenue, qty, margin), `CategoryBarChart`
     - **Tax Report** -- tax collected per code per period, totals for ST-100 quarterly filing, direct CSV/PDF export
     - **Comparisons** -- two date range selectors (range A vs range B), `ComparisonBarChart`, delta table showing % change in key metrics
   - Date range component with presets: Today, Yesterday, This Week, This Month, This Quarter, This Year, Last Month, Last Quarter, Last Year, Custom
   - **Export buttons** (per tab): "Download PDF" and "Download CSV" using `AppButton` with `neutral` variant

9. **Create `ReportDateRangePicker.tsx`** in `src/renderer/src/components/reports/`
   - Preset buttons + custom date inputs (start/end)
   - Comparison mode: shows two date range pickers side by side
   - Reuse `AppButton` for presets, `ValidatedInput` for date fields

10. **Create `ReportSummaryCard.tsx`** -- small stat card (label + big number + optional delta %)
    - Used in Sales Summary tab header row
    - Shows: Gross Sales, Net Sales, Tax Collected, Transactions, Avg Transaction

11. **Wire up the modal trigger** -- add to `HeaderBar` or `BottomShortcutBar` (F-key binding, e.g., F5 for Reports)

#### Phase 3: Testing (_parallel with Phase 2 for backend tests_)

12. **Backend unit tests** -- `src/main/database/reports.repo.test.ts`
    - Use `createTestDb()` pattern, seed with known transactions/products
    - Test each aggregation function with predictable data
    - Test date range filtering, empty results, refund exclusion
    - Test tax summary accuracy
    - _depends on step 2_

13. **Renderer unit tests** -- `src/renderer/src/components/reports/ReportsModal.test.tsx`
    - Mock `window.api.reports:*` calls
    - Test tab switching, date range selection, loading states
    - Test export button calls
    - _depends on step 8_

14. **E2E tests** -- `tests/e2e/reports.spec.ts`
    - Open reports modal, switch tabs, verify chart renders, download export
    - _depends on steps 8-10_

#### Phase 4: Documentation & Quality Gate (_depends on Phase 2-3_)

15. **Create `docs/features/sales-reports.md`** -- feature spec
16. **Update `docs/README.md`** -- add to index
17. **Update `docs/ai/repo-map.md`** -- add new IPC channels & files
18. **Run quality gate** -- prettier, lint, stylelint, typecheck, coverage (>=80%), e2e

---

### Relevant Files

**Modify:**

- `src/shared/types/index.ts` -- add all report-related types
- `src/main/index.ts` -- register `reports:*` IPC handlers
- `src/preload/index.ts` -- expose report API methods
- `src/preload/index.d.ts` -- type declarations for preload
- `src/renderer/src/components/layout/BottomShortcutBar.tsx` -- add Reports F-key trigger
- `package.json` -- add `chart.js` + `react-chartjs-2` dependencies
- `docs/README.md` -- add sales-reports.md to index
- `docs/ai/repo-map.md` -- add new IPC channels

**Create:**

- `src/main/database/reports.repo.ts` -- all SQL aggregation queries
- `src/main/services/report-export.ts` -- PDF/CSV export service
- `src/renderer/src/components/reports/ReportsModal.tsx` -- main modal
- `src/renderer/src/components/reports/ReportsModal.css` -- styles
- `src/renderer/src/components/reports/ReportDateRangePicker.tsx` -- date picker
- `src/renderer/src/components/reports/ReportSummaryCard.tsx` -- stat card
- `src/renderer/src/components/reports/charts/SalesLineChart.tsx` -- line chart
- `src/renderer/src/components/reports/charts/PaymentPieChart.tsx` -- pie chart
- `src/renderer/src/components/reports/charts/ProductBarChart.tsx` -- bar chart
- `src/renderer/src/components/reports/charts/CategoryBarChart.tsx` -- bar chart
- `src/renderer/src/components/reports/charts/ComparisonBarChart.tsx` -- grouped bar
- `src/main/database/reports.repo.test.ts` -- backend tests
- `src/renderer/src/components/reports/ReportsModal.test.tsx` -- renderer tests
- `tests/e2e/reports.spec.ts` -- E2E tests
- `docs/features/sales-reports.md` -- feature spec

**Reference (do not modify):**

- `src/main/database/sessions.repo.ts` -- `generateClockOutReport()` for aggregation query patterns
- `src/renderer/src/components/sales-history/SalesHistoryModal.tsx` -- date presets, filter UI patterns
- `src/renderer/src/components/clock-out/ClockOutReport.tsx` -- report display patterns
- `src/renderer/src/styles/tokens.css` -- design tokens for chart colors

---

### Verification

1. **Backend tests pass:** `npm run test:node` -- all reports.repo.test.ts cases green
2. **Aggregation accuracy:** Seed test DB with known data (e.g., 10 transactions, 3 products, 2 payment methods), verify exact totals from `getSalesSummary`
3. **Tax report accuracy:** Verify tax_collected sums match `SUM(tax_amount)` grouped by code for a known date range
4. **Comparison deltas:** Create two periods with known data, verify % change calculations
5. **Chart rendering:** Component tests verify chart props passed correctly (mocked canvas)
6. **PDF export:** Backend test creates PDF buffer, verifies non-zero length and valid header
7. **CSV export:** Backend test creates CSV string, verifies header row + correct row count
8. **Coverage gate:** `npm run test:coverage` >= 80% for all metrics
9. **Quality gate:** prettier, lint, stylelint, typecheck all pass
10. **Visual:** Open app, click Reports, verify charts render, tabs switch, exports download
11. **3-year retention:** Verify queries work on `created_at` ranges spanning 3+ years

---

### Decisions

- **Chart.js + react-chartjs-2** over Recharts -- 50% smaller bundle, canvas rendering (faster for large datasets), tree-shakeable, no Redux dependency
- **No new Zustand store** for reports -- report data is fetched on-demand per tab/date-range change, held in local React state (like SalesHistoryModal pattern)
- **Reports repo as separate file** (`reports.repo.ts`) rather than extending `transactions.repo.ts` -- keeps aggregation queries cleanly separated from CRUD
- **Export happens in main process** -- pdfkit runs in Node (not renderer), file save dialog is native Electron
- **No real-time/live dashboard** -- reports are pulled on-demand, not streaming. Consistent with the "feels instant" design constraint
- **Food stamp tracking** deferred -- the `allow_food_stamps` field exists on products but no separate reporting for it yet. Can be added as a filter later
- **Animations disabled** on all charts -- per design system constraint

### Further Considerations

1. **F-key assignment for Reports:** F5 is unused in BottomShortcutBar currently. Recommend F5. Alternatively, could be a menu item or header button. Which approach?
2. **Quarterly tax report format:** Should the Tax Report tab auto-detect NYS quarterly periods (Mar 1 - May 31, Jun 1 - Aug 31, Sep 1 - Nov 30, Dec 1 - Feb 28) or just offer generic date ranges? Recommend auto-detecting NYS quarters since this is NYC-focused.
3. **Comparison granularity:** Should comparisons be limited to predefined pairs (this month vs last month, this year vs last year) or allow fully custom range-vs-range? Recommend fully custom with presets for common comparisons.
