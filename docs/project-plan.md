# Liquor Store POS System - Project Plan

**Project Name:** LiquorPOS  
**Started:** February 27, 2026  
**Target Platform:** Windows Desktop (developed on macOS)  
**Inspiration:** PC America POS UI/UX  
**Business Model:** SaaS POS sold to liquor stores with integrated Stax payment processing; revenue via per-transaction residuals as a Stax Partner/ISV

---

## 🎯 Project Vision

Build a fast, reliable, and simple Point of Sale system specifically designed for liquor stores. The application should feel familiar to users already experienced with PC America, while being snappy and maintainable with modern technology.

---

## 🔑 Core Principles

1. **Speed First** - Application must be snappy and responsive
2. **Simplicity** - Clean, functional UI without unnecessary animations
3. **Reliability** - Stable, production-ready code
4. **Maintainability** - Well-structured, properly abstracted codebase
5. **Best Practices** - Following industry-standard coding patterns

---

## 🛠 Tech Stack

### Frontend Framework

- **Electron** - Cross-platform desktop application framework
  - Mature ecosystem with extensive documentation
  - Excellent Windows support
  - Large community and tooling
  - Proven in production POS systems

### UI Layer

- **React 18+** - Component-based UI library
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool and dev server
- **BEM CSS** - Component-scoped CSS with BEM naming and concentric property ordering

### State Management

- **Zustand** - Lightweight, simple state management
  - Less boilerplate than Redux
  - Perfect for POS transaction state
  - Easy to learn and maintain

### Database

- **SQLite** (via better-sqlite3)
  - Local, serverless database
  - Perfect for desktop POS applications
  - ACID compliant for transaction safety
  - No network dependency
  - Fast read/write operations

### Development Tools

- **ESLint** - Code quality and consistency
- **Prettier** - Code formatting
- **Husky** - Git hooks for quality checks
- **TypeScript Strict Mode** - Maximum type safety

### Testing (Implemented)

- **Vitest** - Fast unit testing (with coverage gate >= 80%)
- **React Testing Library** - Component testing
- **Playwright** - E2E testing (startup, transactions, inventory management)

### Payment Processing (Phase 3 — Planned)

- **Stax Partner API** - Payment processing via Partner/ISV model
  - Merchant onboarding & underwriting
  - Terminal-based card payments
  - Surcharge support
  - Partner-level webhooks & reporting

---

## 📦 MVP Scope (Phase 1) — COMPLETE

### Must Have

1. **Sales Interface** ✅
   - ✅ Product search/lookup
   - ✅ Add items to cart
   - ✅ Remove/modify cart items
   - ✅ Calculate totals (subtotal, tax, total)
   - ✅ Complete sale (cash/card payment modal)
   - ✅ Clear/void transaction
   - ⏳ Print receipt (PDF generation)

2. **Basic UI** ✅
   - ✅ Main POS screen (POSScreen.tsx)
   - ✅ Shopping cart / ticket panel (TicketPanel)
   - ✅ Action panel with item management
   - ✅ Bottom shortcut bar
   - ✅ Payment modal (PaymentModal)
   - ✅ Search functionality

3. **Data Persistence** ✅
   - ✅ SQLite database with better-sqlite3
   - ✅ Products, transactions, transaction_items tables
   - ✅ Load product catalog via IPC
   - ⏳ Transaction history view

4. **Testing** ✅
   - ✅ Unit tests (Vitest + React Testing Library)
   - ✅ E2E tests (Playwright — startup, transactions, inventory)
   - ✅ Coverage gate >= 80%

### Deferred to Phase 2 — MOSTLY COMPLETE

- ✅ Inventory Management (full CRUD — items, search, detail view)
- ✅ Department Management (CRUD)
- ✅ Tax Code Management (CRUD)
- ✅ Vendor Management (CRUD)
- ✅ Special Pricing rules per product
- ✅ Multiple SKU / alternate barcode support
- ⏳ Customer Management
- ⏳ Reporting & Analytics
- ⏳ User Authentication
- ⏳ Multi-register support
- ⏳ Product import/export (CSV)
- ⏳ Low stock alerts

### Deferred to Phase 3 — PLANNED

- ⏳ **Stax Payment Processing Integration** (Partner API)
- ⏳ Barcode Scanner Integration
- ⏳ Receipt Printer Integration
- ⏳ Cloud Sync/Backup

---

## 🏗 Project Architecture

```
liquor-pos/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts         # Main entry point
│   │   ├── database/        # SQLite connection & queries
│   │   ├── services/        # Business logic services
│   │   └── ipc/             # IPC handlers
│   ├── renderer/            # React application
│   │   ├── App.tsx          # Root component
│   │   ├── pages/           # Page components
│   │   │   ├── POSScreen/   # Main POS interface
│   │   │   ├── History/     # Transaction history
│   │   │   └── Settings/    # App settings
│   │   ├── components/      # Reusable components
│   │   │   ├── Cart/
│   │   │   ├── ProductGrid/
│   │   │   ├── Keypad/
│   │   │   └── common/
│   │   ├── store/           # Zustand stores
│   │   ├── hooks/           # Custom React hooks
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Helper functions
│   │   └── styles/          # Global styles
│   ├── shared/              # Code shared between main & renderer
│   │   └── types/           # Shared TypeScript types
│   └── preload/             # Electron preload scripts
├── docs/                    # Additional documentation
├── scripts/                 # Build and utility scripts
├── resources/               # App icons, assets
└── tests/                   # Test files

```

---

## 💾 Database Schema (Initial)

### Products Table

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  cost REAL,
  quantity INTEGER DEFAULT 0,
  barcode TEXT,
  tax_rate REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Transactions Table

```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_number TEXT UNIQUE NOT NULL,
  subtotal REAL NOT NULL,
  tax_amount REAL NOT NULL,
  total REAL NOT NULL,
  payment_method TEXT,
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Transaction Items Table

```sql
CREATE TABLE transaction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

---

## 🚀 Development Phases

### Phase 1: MVP - Core POS Functionality ✅ COMPLETE

**Timeline:** 2-3 weeks (completed)  
**Goal:** Working POS that can ring up sales

- [x] Project setup & configuration (Electron + Vite + React + TypeScript)
- [x] Database setup with SQLite (better-sqlite3)
- [x] Seed sample product data
- [x] Build main POS screen UI (POSScreen, TicketPanel, ActionPanel)
- [x] Implement cart functionality (Zustand store — usePosScreen)
- [x] Product search and selection
- [x] Transaction calculation (tax, totals)
- [x] Save transactions to database
- [x] Payment modal (cash / card)
- [x] Unit + E2E test suite with 80% coverage gate
- [ ] Transaction history view
- [ ] Basic receipt generation (PDF)

### Phase 2: Inventory & Management — IN PROGRESS

**Timeline:** 2-3 weeks

- [x] Full inventory management CRUD (InventoryModal, ItemForm)
- [x] Department management CRUD (DepartmentPanel)
- [x] Tax code management CRUD (TaxCodePanel)
- [x] Vendor management CRUD (VendorPanel)
- [x] Special pricing rules per product
- [x] Alternate SKU / barcode support
- [x] Inventory E2E tests
- [ ] Product import/export (CSV)
- [ ] Low stock alerts
- [ ] Customer database
- [ ] Sales reports
- [ ] User authentication

### Phase 3: Stax Payment Integration — PLANNED

**Timeline:** 3-4 weeks  
**Goal:** Integrated payment processing via Stax Partner API

See [Stax Integration Plan](#-stax-partner-integration-plan) below.

- [ ] Apply for Stax Partner/ISV account
- [ ] Build backend service (Node.js API with PartnerApiKey)
- [ ] Implement merchant onboarding flow (POST /admin/enroll)
- [ ] Wire POS "Pay" button to Stax terminal charge (POST /terminal/charge)
- [ ] Surcharge review (GET /surcharge/review)
- [ ] Store Stax transaction_id alongside local transactions
- [ ] Partner-level webhooks for revenue tracking
- [ ] Admin dashboard for portfolio monitoring

### Phase 4: Hardware & Polish

**Timeline:** 2-3 weeks

- [ ] Barcode scanner support
- [ ] Receipt printer integration
- [ ] Cloud sync/backup
- [ ] Multi-register support
- [ ] Advanced reporting
- [ ] Keyboard shortcuts

---

## 🎨 UI/UX Guidelines (PC America Inspired)

### Layout

- **Main Area:** Product grid/categories (left/center)
- **Right Sidebar:** Shopping cart with line items
- **Top Bar:** Search, user info, quick actions
- **Bottom:** Transaction totals, payment buttons

### Design Principles

- **High Contrast:** Easy to read in various lighting
- **Large Touch Targets:** Button sizes friendly for touchscreen
- **Keyboard Navigation:** Full keyboard support for speed
- **Minimal Colors:** Functional color palette (black, white, blue accents)
- **Clear Typography:** Large, readable fonts
- **No Animations:** Instant transitions, no delays

### Color Palette

- Primary: `#1e40af` (Blue 800)
- Success: `#16a34a` (Green 600)
- Warning: `#eab308` (Yellow 500)
- Danger: `#dc2626` (Red 600)
- Background: `#f9fafb` (Gray 50)
- Surface: `#ffffff` (White)
- Text: `#111827` (Gray 900)

---

## 📋 Prerequisites to Install

Before starting development, install the following:

### Required

1. **Node.js** (v20 LTS or later)

   ```bash
   brew install node
   ```

2. **Git**

   ```bash
   brew install git
   ```

3. **Xcode Command Line Tools** (for native modules)

   ```bash
   xcode-select --install
   ```

4. **Visual Studio Code** (recommended IDE)
   - Extensions: ESLint, Prettier, Stylelint

### For Windows builds (can install later)

5. **Wine** (to build Windows apps from macOS)
   ```bash
   brew install --cask wine-stable
   ```

---

## 🔐 Repository Setup

- **Repository Name:** `liquor-pos`
- **Visibility:** Private
- **Branch Strategy:**
  - `main` - Production-ready code
  - `develop` - Active development
  - Feature branches: `feature/[name]`
  - Bug fixes: `fix/[name]`

### Commit Convention

Following Conventional Commits:

- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `chore:` - Tooling, dependencies

---

## 📝 Next Steps

1. ✅ Create project directory
2. ✅ Write project plan
3. ⏳ Initialize Git repository
4. ⏳ Create GitHub private repository
5. ⏳ Initialize Electron + React + Vite project
6. ⏳ Setup project dependencies
7. ⏳ Configure TypeScript, ESLint, Prettier
8. ⏳ Setup database with sample data
9. ⏳ Create basic app shell
10. ⏳ Start building POS screen

---

## � Stax Partner Integration Plan

### Business Model

You = **Stax Partner (ISV)**. Each liquor store = a **sub-merchant** under your Partner account.

| Your role                    | Stax role                       | Liquor store role             |
| ---------------------------- | ------------------------------- | ----------------------------- |
| Platform/ISV (LiquorPOS app) | Payment processor + underwriter | Sub-merchant under your brand |

**Revenue:** When you enroll a merchant, you define their `pricing_plan` (per-txn rate, discount rate). Stax handles billing and pays you a **residual/revenue share** on every transaction your merchants process.

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  LiquorPOS App  │────▶│  Your Backend    │────▶│  Stax API   │
│  (Electron)     │     │  (Node.js API)   │     │  Partner    │
│                 │     │  PartnerApiKey   │     │             │
└─────────────────┘     └──────────────────┘     └─────────────┘
        │                                               │
        │  ApiKeyAuth (per-merchant)                    │
        └───────────────────────────────────────────────┘
              Direct transaction calls
```

### Auth Model

| Key type          | Scope                          | Usage                                                         |
| ----------------- | ------------------------------ | ------------------------------------------------------------- |
| **PartnerApiKey** | All merchants under your brand | Backend server for onboarding, portfolio management           |
| **ApiKeyAuth**    | Single merchant                | Each POS install uses the merchant's own key for transactions |
| **EphemeralAuth** | Temporary, 24hr                | Secure one-time actions from the POS client                   |

### Key Stax API Endpoints

#### Merchant Onboarding (PartnerApiKey)

| Endpoint                                | Purpose                                                                |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `POST /admin/enroll`                    | Create merchant + user + registration in one call; starts underwriting |
| `POST /merchant`                        | Create a merchant (lightweight)                                        |
| `GET /merchant`                         | List all merchants in your portfolio                                   |
| `GET /merchant/{id}`                    | Get store details                                                      |
| `POST /merchant/{id}/apikey`            | Generate per-merchant API key for POS app                              |
| `PUT /merchant/{id}/registration`       | Update registration/underwriting data                                  |
| `POST /merchant/{id}/registration/file` | Upload KYC documents                                                   |

#### Payment Processing (ApiKeyAuth per-merchant)

| Endpoint                        | Purpose                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| `POST /terminal/charge`         | Charge via physical card terminal (Dejavoo, etc.)             |
| `POST /charge`                  | Charge a tokenized payment method (keyed entry, card-on-file) |
| `GET /terminal/register`        | List connected card reader devices                            |
| `POST /terminal/void-or-refund` | Void or refund at terminal                                    |
| `GET /surcharge/review`         | Check surcharge amount before charging                        |
| `POST /payment-method/`         | Tokenize a card                                               |

#### Portfolio Monitoring (PartnerApiKey)

| Endpoint                                  | Purpose                                  |
| ----------------------------------------- | ---------------------------------------- |
| `POST /webhookadmin/webhook/brand`        | Partner-level webhooks for ALL merchants |
| `GET /query/deposit`                      | Track settlement batches                 |
| `GET /query/statistics/teamSummary`       | Dashboard stats                          |
| `GET /transaction`                        | List/filter all transactions             |
| `GET /underwriting/disputes/{merchantId}` | Track chargebacks                        |

#### Branding / White-Label

| Endpoint                     | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| `POST /team/option/branding` | Upload your logo; merchants see YOUR brand |
| `PUT /team/options`          | Configure team-level settings              |

### Webhook Events Available (Brand-Level)

`create_transaction`, `update_transaction`, `update_transaction_settled`, `create_deposit`, `create_dispute`, `update_dispute`, `create_merchant`, `update_merchant_status`, `update_underwriting`, `update_electronic_signature`

### Sandbox / Test Environment

Stax uses **one API URL** for both sandbox and production: `https://apiprod.fattlabs.com/`  
The sandbox/live distinction is determined by **which API key** you use (sandbox key vs live key).

#### Getting Sandbox Access

1. **Merchant Developers:** Request a sandbox account at [https://staxpayments.com/request-sandbox/](https://staxpayments.com/request-sandbox/)
2. **Partner Developers:** Log in to Stax Connect → toggle **Test Mode** in the left menu → create test merchants from there
3. Sandbox accounts connect to a **test gateway** — no real transactions are processed

#### Test Card Numbers

| Card Type        | Success Card 1     | Success Card 2     |
| ---------------- | ------------------ | ------------------ |
| Visa             | `4111111111111111` | `4012888888881881` |
| Mastercard       | `5555555555554444` | `5105105105105100` |
| American Express | `378282246310005`  | `371449635398431`  |
| Discover         | `6011111111111117` | `6011000990139424` |

**Test Debit Card (Mastercard):** `2223003122003222`

**Test ACH/Bank:**

- Routing: `021000021`
- Account: `9876543210`

**Failure testing:** Any card number not in the above list will trigger a failure in sandbox. The `Transaction.message` field will read "Unable to process the purchase transaction" (in sandbox) or the real decline reason (in production).

**Card Present testing:** Contact support@fattmerchant.com to set up terminal device testing with your sandbox merchant account.

### Implementation Steps

#### Step 1: Partner Onboarding

1. Apply to become a Stax Partner/ISV — get `PartnerApiKey` + `brand` identifier
2. Define `pricing_plan`(s) with Stax (your per-transaction markup)
3. Get sandbox credentials for development

#### Step 2: Backend Service

1. Build a lightweight Node.js/Express API that holds the `PartnerApiKey`
2. Endpoints: enroll merchant, list merchants, generate merchant API keys
3. Webhook receiver for transaction events & merchant status updates
4. Admin dashboard aggregating volume, revenue share, chargebacks

#### Step 3: Merchant Onboarding Flow

1. New store signs up → backend calls `POST /admin/enroll`
2. Stax creates merchant, starts KYC/KYB underwriting
3. Backend calls `POST /merchant/{id}/apikey` for the store's API key
4. POS app is configured with that merchant's API key
5. Webhook `update_merchant_status` notifies when underwriting completes

#### Step 4: POS Payment Integration

1. **Terminal flow** (card reader): `POST /terminal/charge` with register_id, total, meta (line items, tax)
2. **Keyed/card-on-file**: `POST /charge` with payment_method_id, total
3. Check `GET /surcharge/review` first if credit surcharging is enabled
4. Store Stax `transaction_id` in local SQLite alongside existing transaction record
5. Handle void/refund via `POST /terminal/void-or-refund`

#### Step 5: Revenue & Monitoring

1. Register brand-level webhooks for `create_transaction` + `update_transaction_settled`
2. Backend aggregates: volume per store, your residual revenue, settlement status
3. `GET /query/deposit` for daily reconciliation
4. `GET /underwriting/disputes/{merchantId}` for chargeback monitoring

---

## �📚 Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Stylelint Documentation](https://stylelint.io)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [Stax API Documentation](https://docs.staxpayments.com/)
- [Stax Connect Overview](https://docs.staxpayments.com/docs/stax-connect-overview)
- [Stax Partner Program](https://staxpayments.com/partners/)
- [Stax Test Environments](https://docs.staxpayments.com/docs/test-environments)
- [Stax Test Card Numbers](https://docs.staxpayments.com/docs/test-card-payment-methods)
- [Stax Merchant Enrollment Methods](https://docs.staxpayments.com/docs/enrollment-methods)
- [Stax Webhook Events (Partner)](https://docs.staxpayments.com/docs/partner-webhooks)
- [Request Stax Sandbox](https://staxpayments.com/request-sandbox/)
- Stax API Base URL: `https://apiprod.fattlabs.com/`

---

## 🤝 Development Workflow

1. Create feature branch from `develop`
2. Implement feature with tests
3. Run linting and formatting
4. Commit with conventional commit message
5. Push and create pull request
6. Code review
7. Merge to `develop`
8. Periodically merge `develop` to `main` for releases

---

**Last Updated:** March 3, 2026
