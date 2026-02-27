# Liquor Store POS System - Project Plan

**Project Name:** LiquorPOS  
**Started:** February 27, 2026  
**Target Platform:** Windows Desktop (developed on macOS)  
**Inspiration:** PC America POS UI/UX

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
- **Tailwind CSS** - Utility-first CSS framework for rapid, consistent styling

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

### Testing (Future Phase)

- **Vitest** - Fast unit testing
- **React Testing Library** - Component testing
- **Playwright** - E2E testing

---

## 📦 MVP Scope (Phase 1)

### Must Have

1. **Sales Interface**
   - Product search/lookup
   - Add items to cart
   - Remove/modify cart items
   - Calculate totals (subtotal, tax, total)
   - Complete sale (without payment processing)
   - Print receipt (PDF generation)
   - Clear/void transaction

2. **Basic UI**
   - Main POS screen
   - Product grid/list view
   - Shopping cart panel
   - Numeric keypad for quantities
   - Category navigation
   - Search functionality

3. **Data Persistence**
   - Save transactions to local database
   - Load product catalog
   - Transaction history view

### Deferred to Phase 2

- Inventory Management (full CRUD)
- Customer Management
- Reporting & Analytics
- User Authentication
- Multi-register support

### Deferred to Phase 3

- Payment Processing Integration
- Barcode Scanner Integration
- Receipt Printer Integration
- Cloud Sync/Backup

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

### Phase 1: MVP - Core POS Functionality (Current)

**Timeline:** 2-3 weeks  
**Goal:** Working POS that can ring up sales

- [ ] Project setup & configuration
- [ ] Database setup with SQLite
- [ ] Seed sample product data
- [ ] Build main POS screen UI
- [ ] Implement cart functionality
- [ ] Product search and selection
- [ ] Transaction calculation (tax, totals)
- [ ] Save transactions to database
- [ ] Transaction history view
- [ ] Basic receipt generation (PDF)

### Phase 2: Inventory & Management

**Timeline:** 2-3 weeks

- [ ] Full inventory management CRUD
- [ ] Category management
- [ ] Product import/export (CSV)
- [ ] Low stock alerts
- [ ] Customer database
- [ ] Sales reports
- [ ] User authentication

### Phase 3: Integrations & Polish

**Timeline:** 2-3 weeks

- [ ] Payment processor integration
- [ ] Barcode scanner support
- [ ] Receipt printer integration
- [ ] Cloud backup
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
   - Extensions: ESLint, Prettier, Tailwind CSS IntelliSense

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

## 📚 Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)

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

**Last Updated:** February 27, 2026
