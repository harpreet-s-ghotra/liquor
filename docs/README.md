# LiquorPOS Documentation

## Project Goal

Build a fast, reliable Point of Sale system for liquor stores. The app should feel familiar to PC America users while being maintainable with modern technology. Revenue comes from per-transaction residuals as a Stax Partner/ISV.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron (electron-vite) |
| UI | React 19 + TypeScript |
| State | Zustand 5 |
| Database | SQLite (better-sqlite3) |
| Payments | Stax Partner API |
| Testing | Vitest (unit, ≥80% coverage) + Playwright (E2E) |
| Styling | Custom CSS with design tokens (no Tailwind at runtime) |

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** — Core POS | ✅ Complete | Sales interface, cart, payments, transactions, search |
| **Phase 2** — Inventory & Management | ✅ Mostly Complete | Full CRUD for items, departments, tax codes, vendors, special pricing, alternate SKUs, case/quantity fields |
| **Phase 3** — Stax Integration | 🟡 In Progress | Activation screen, cashier PIN login done; terminal charges, webhooks, sales history pending |
| **Phase 4** — Hardware & Polish | ⏳ Planned | Barcode scanner, receipt printer, cloud sync |

## Documentation Index

### Overall Plan
- [PROJECT_PLAN.md](../PROJECT_PLAN.md) — Full project vision, tech stack details, roadmap, database schema, Stax architecture

### Feature Implementation Docs
- [UI Architecture](UI_ARCHITECTURE.md) — Layout rules, design tokens, component boundaries, CSS strategy
- [Inventory Management V1](inventory-management-v1.md) — Inventory modal, CRUD operations, search, form fields, data contracts
- [Pricing Engine Plan](pricing-engine-plan.md) — Special pricing fix, mix-and-match pricing, pricing engine architecture
- [Stax Activation & Login](stax-activation-and-login.md) — Merchant activation flow, cashier PIN login, auth state machine
- [Stax Integration Plan](stax-integration-plan.md) — Partner API architecture, endpoints, test cards, webhook events, implementation steps
- [Product Search Modal](product-search-modal.md) — Search button on POS screen, modal with filters, product lookup flow

### Developer Guidelines
- [Copilot Instructions](../.github/copilot-instructions.md) — Testing gate, quality commands, coding conventions

## Key Architectural Decisions

1. **All data from backend** — No hardcoded product data in the renderer. All inventory comes from SQLite via IPC.
2. **Auth state machine** — App has 4 states: `loading → needs-activation → needs-login → authenticated`, managed by `useAuthStore`.
3. **Single merchant per install** — Each POS install is activated with one Stax merchant API key (stored in `merchant_config` table).
4. **CSS design tokens** — Defined in `src/renderer/src/styles/tokens.css`. All colors, spacing, and sizing use CSS custom properties.
5. **Coverage gate** — Every change must maintain ≥80% coverage across statements, branches, functions, and lines.

## Adding a New Feature

1. Create a doc in `docs/` describing scope, data contract, and UX requirements.
2. Reference it from this index.
3. Follow the quality sequence: `lint → typecheck → test:coverage → test:e2e`.
4. Keep unit tests deterministic and independent from external services.
