# LiquorPOS Features

A complete point of sale system built for liquor stores. LiquorPOS runs as a desktop application on Windows, with fast local performance and optional cloud sync for multi-register setups.

---

## Fast Checkout

Ring up sales quickly with barcode scanning, keyboard shortcuts, and instant product search. The checkout screen is designed for high-volume retail with large touch-friendly buttons and a clean, distraction-free layout.

- Scan barcodes or search by name, SKU, or department
- Keyboard shortcuts for every action (F1-F5 for common operations)
- Hold and recall transactions for customers who need to step away
- Automatic tax calculation based on configurable tax codes
- Split payments across multiple payment methods (cash + card)
- Cash tendering with automatic change calculation

## Inventory Management

Full product catalog management with support for the specialized needs of liquor retail. Track stock levels, manage departments, assign tax codes, and organize products by distributor.

- Create and edit products with SKU, cost, retail price, and stock quantity
- Organize by department (Wine, Beer, Spirits, and custom categories)
- Assign tax codes per product with automatic tax calculation
- Track distributor and sales rep information per product
- Case pricing with configurable bottles-per-case and case discounts
- Additional SKUs per product for multi-pack or variant barcodes
- Special pricing rules (buy X get Y, quantity discounts)
- Product search and filtering across the full catalog

## Integrated Payments

Accept credit, debit, and cash payments with built-in Finix payment processing. No separate payment terminal software needed -- card processing is built into the POS.

- Credit and debit card processing via Finix
- Cash payments with automatic change calculation
- Split payments (part cash, part card)
- Void and refund support directly from transaction history
- Card details stored securely (last four digits only for receipts)
- Automatic reconciliation with end-of-day reports

## Sales Reports

Comprehensive reporting for daily operations and tax compliance. View sales trends, analyze product performance, and generate tax reports for quarterly filing.

- **Sales Summary** -- gross sales, net sales, tax collected, transaction count, average transaction value with daily trend charts
- **Product Analysis** -- top-selling products by revenue or quantity, profit margins, category breakdown
- **Tax Report** -- tax collected by code and period, designed for NYS ST-100 quarterly filing
- **Period Comparison** -- compare any two date ranges side by side with percentage change calculations
- **Cashier Performance** -- sales by cashier, average ticket size
- **Hourly Sales** -- identify peak hours and staffing needs
- Export to PDF or CSV for accountants and auditors
- Date range presets (today, this week, this month, this quarter, custom)

## Clock In / Clock Out

Track register sessions with PIN-based clock in and clock out. Each session generates a detailed end-of-day report for cash reconciliation.

- PIN-based login for each cashier
- Session tracking with start and end times
- End-of-day report with sales breakdown by payment method and department
- Cash reconciliation (expected vs. actual drawer amount)
- Print clock-out reports for manager review
- Session history for auditing past shifts

## Receipt Printing

Print receipts on standard thermal receipt printers with configurable formatting. Customize the store name, footer message, font size, and layout.

- USB and network receipt printer support
- Configurable store name and footer message
- Adjustable font size and padding
- Test print to verify configuration
- Automatic printing after each transaction (optional)
- Clock-out report printing

## Cash Drawer

Integrated cash drawer support via USB or TCP/IP connection. The drawer opens automatically on cash transactions and can be opened manually when needed.

- USB and TCP/IP cash drawer support
- Auto-open on cash payments
- Manual open via keyboard shortcut
- Configurable connection settings

## Cloud Sync

Optional multi-register sync via Supabase. Transactions and inventory changes made on one register automatically appear on all others. Works offline -- changes queue locally and sync when connectivity returns.

- Real-time transaction sync between registers
- Inventory delta sync (stock adjustments propagate across registers)
- Product, tax code, department, and distributor sync
- Offline-first -- the app works without internet and syncs when connected
- Automatic conflict resolution and deduplication
- Device registration and management

## Automatic Updates

The app checks for updates automatically and notifies the merchant when a new version is available. Updates download in the background and install on the next restart -- no manual download required.

- Automatic update checking on app launch
- Non-intrusive notification when updates are available
- Background download with progress indicator
- Install on restart or next app quit
- No manual intervention needed

## Security and Compliance

Built with liquor retail compliance in mind, including NYS tax reporting requirements.

- PIN-based cashier authentication (no shared logins)
- Sequential transaction numbering with full audit trail
- Void and refund tracking with reason codes
- Tax records retained for 3+ years (NYS TB-ST-770 compliance)
- Taxable vs. non-taxable item separation
- Machine-readable data export (CSV) for auditors
- All payment credentials stored securely (never in source code)

---

## System Requirements

- **Operating System:** Windows 10 or later
- **Peripherals:** USB or network receipt printer (optional), USB or TCP/IP cash drawer (optional), barcode scanner (USB HID, optional)
- **Internet:** Required for initial setup and payment processing. Optional for offline cash-only operation.
- **Download:** Available at [checkoutmain.co](https://checkoutmain.co)
