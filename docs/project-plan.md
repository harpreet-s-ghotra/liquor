# Liquor Store POS System - Project Plan

**Project Name:** LiquorPOS  
**Started:** February 27, 2026  
**Target Platform:** Windows Desktop (developed on macOS)  
**Inspiration:** PC America POS UI/UX  
**Business Model:** SaaS POS sold to liquor stores with integrated Finix payment processing; revenue via per-transaction residuals under the Finix ISV/platform model

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

- **Finix API** - Payment processing via the ISV/platform model
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
- ✅ Distributor Management (CRUD)
- ✅ Special Pricing rules per product
- ✅ Multiple SKU / alternate barcode support
- ⏳ Customer Management
- ⏳ Reporting & Analytics
- ⏳ User Authentication
- ⏳ Multi-register support
- ⏳ Product import/export (CSV)
- ⏳ Low stock alerts

### Deferred to Phase 3 — PLANNED

- ⏳ **Finix Payment Processing Integration**
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
- [x] Distributor management CRUD (DistributorPanel)
- [x] Special pricing rules per product
- [x] Alternate SKU / barcode support
- [x] Inventory E2E tests
- [ ] Product import/export (CSV)
- [ ] Low stock alerts
- [ ] Customer database
- [ ] Sales reports
- [ ] User authentication

### Phase 3: Finix Payment Integration — IN PROGRESS

**Timeline:** 3-4 weeks  
**Goal:** Integrated payment processing via Finix, with Phase A manual/sandbox card flow live and Phase B device workflows still pending.

See [Finix Payment Integration](features/finix-integration.md) for the active implementation plan.

- [x] Replace local merchant payment config with Finix credentials
- [x] Add Finix card-charge flow to the POS payment modal
- [x] Persist Finix authorization and transfer IDs on transactions
- [x] Process card refunds through Finix before saving local refund records
- [ ] Finish Phase B device management and terminal charging
- [ ] Add operational monitoring and settlement reporting

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

## Finix Integration Snapshot

### Current Implementation

- Merchants authenticate through Supabase and receive Finix credentials through the desktop onboarding path.
- Phase A payments use Finix sandbox/manual card charges from the payment modal.
- Successful sales persist both `finix_authorization_id` and `finix_transfer_id` locally and in sync payloads.
- Card refunds call Finix using the original `finix_transfer_id` before the refund is saved locally.
- Phase B device registration, listing, and terminal charging remain the open payment milestone.

---

## �📚 Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Stylelint Documentation](https://stylelint.io)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [Finix Payment Integration](features/finix-integration.md)
- [Supabase Onboarding](features/supabase-onboarding.md)
- [Cloud Sync](features/cloud-sync.md)

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
