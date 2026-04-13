# High Spirits POS Documentation

> Master index for all project documentation. Start here.

## Project

| Doc                               | Covers                                                           |
| --------------------------------- | ---------------------------------------------------------------- |
| [Project Plan](project-plan.md)   | Full vision, roadmap, database schema, Finix architecture        |
| [Design System](design-system.md) | Visual spec -- colors, typography, layout rules, component specs |

## Feature Specs

| Doc                                                          | Status      | Covers                                                               |
| ------------------------------------------------------------ | ----------- | -------------------------------------------------------------------- |
| [Inventory V1](features/inventory-v1.md)                     | Complete    | Inventory CRUD, search, form fields, data contracts                  |
| [Inventory V2](features/inventory-v2.md)                     | Active      | Inventory modal redesign, new fields, footer action bar              |
| [Pricing Engine](features/pricing-engine.md)                 | Complete    | Special pricing, mix-and-match, pricing engine architecture          |
| [Product Search](features/product-search.md)                 | Complete    | Search modal, filters, product lookup flow                           |
| [Returns and Refunds](features/returns-and-refunds.md)       | Complete    | Return workflow, refund scenarios, inventory impact                  |
| [Clock In/Clock Out](features/clock-in-clock-out.md)         | Complete    | Register sessions, end-of-day report, cash reconciliation            |
| [Stax Activation](features/stax-activation.md)               | Superseded  | Merchant activation flow, cashier PIN login, auth state machine      |
| [Supabase Onboarding](features/supabase-onboarding.md)       | Active      | Supabase auth, PIN setup, distributor catalog import (Phase A)       |
| [Cloud Sync](features/cloud-sync.md)                         | In Progress | Multi-register transaction & inventory sync via Supabase Realtime    |
| [Finix Integration](features/finix-integration.md)           | Active      | Finix credentials, manual card charges, refunds, device roadmap      |
| [NYSLA Schema Alignment](features/nysla-schema-alignment.md) | Complete    | Inventory fields aligned with NYSLA Price Postings for future import |
| [Sales Reports](features/sales-reports.md)                   | Complete    | Sales summary, product/category analysis, tax report, comparisons    |

## AI Navigation

AI agents should read these before searching the codebase:

| Index                                | Covers                                                  |
| ------------------------------------ | ------------------------------------------------------- |
| [Repo Map](ai/repo-map.md)           | Architecture, entry points, IPC channels, module lookup |
| [Testing Map](ai/testing-map.md)     | Test locations, runners, patterns, how to add tests     |
| [Inventory Map](ai/inventory-map.md) | All inventory feature files, components, types, tests   |
| [Finix Map](ai/finix-map.md)         | Payment/auth files, Finix API, refunds, device roadmap  |
| [Glossary](ai/glossary.md)           | Canonical terms and definitions                         |

## E2E Test Coverage

Auto-maintained by the `update-test-docs` agent. See [Test Coverage Index](tests/README.md).

## Conventions

- **Naming:** All doc files use `kebab-case.md`
- **Location:** Feature specs go in `features/`. AI indexes go in `ai/`. Test docs go in `tests/`.
- **New features:** Create a spec in `features/`, add it to this index, and reference it from `CLAUDE.md`
- **Active work:** Mark status as "Active" in the table above
