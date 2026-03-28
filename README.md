# LiquorPOS

Desktop Point of Sale system for liquor stores. Built on Electron, inspired by PC America POS. Revenue from per-transaction residuals via Stax payment processing as a Partner/ISV.

## Tech Stack

| Layer         | Technology                  |
| ------------- | --------------------------- |
| Desktop shell | Electron 39 (electron-vite) |
| UI            | React 19 + TypeScript       |
| State         | Zustand 5                   |
| Styling       | BEM CSS + design tokens     |
| Database      | SQLite via better-sqlite3   |
| Payments      | Stax Partner API            |
| Testing       | Vitest + Playwright         |

## Quick Start

```bash
npm install
npm run dev
```

## Key Commands

```bash
npm run dev              # Start Electron app in development
npm run dev:renderer     # Renderer only (Vite on :4173) -- for E2E tests
npm run lint             # ESLint
npm run typecheck        # TypeScript type checking
npm run test             # All unit tests
npm run test:coverage    # Coverage (must stay >= 80%)
npm run test:e2e         # Playwright E2E tests
npm run build            # Production build
```

## Documentation

All docs live in [docs/](docs/README.md). Start with `docs/README.md` for the full index.

For AI-assisted development, see [CLAUDE.md](CLAUDE.md) (Claude Code) and [.github/copilot-instructions.md](.github/copilot-instructions.md) (Copilot).

## Project Status

| Phase                          | Status          |
| ------------------------------ | --------------- |
| Phase 1 -- Core POS            | Complete        |
| Phase 2 -- Inventory           | Mostly Complete |
| Phase 3 -- Stax Integration    | In Progress     |
| Phase 4 -- Hardware and Polish | Planned         |
