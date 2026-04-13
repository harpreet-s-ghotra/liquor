# Copilot Instructions

## AI Index -- Read Before Searching

Before searching the codebase, read the relevant index doc in `docs/ai/`:

- **[docs/ai/repo-map.md](../docs/ai/repo-map.md)** -- Architecture, layer entry points, IPC channels, module lookup table
- **[docs/ai/testing-map.md](../docs/ai/testing-map.md)** -- Test locations, runners, patterns, how to add tests
- **[docs/ai/inventory-map.md](../docs/ai/inventory-map.md)** -- All inventory feature files, components, types, tests
- **[docs/ai/finix-map.md](../docs/ai/finix-map.md)** -- Payment/auth files, Finix API, refunds, device roadmap
- **[docs/ai/glossary.md](../docs/ai/glossary.md)** -- Canonical terms and definitions

Routing: read `repo-map.md` first for general tasks. Read the feature-specific map for scoped work. Check `glossary.md` when a domain term is ambiguous.

## Documentation

All documentation lives in `docs/`. See `docs/README.md` for the full index.

- **[docs/README.md](../docs/README.md)** -- Master documentation index
- **[docs/project-plan.md](../docs/project-plan.md)** -- Full project vision, roadmap, database schema
- **[docs/design-system.md](../docs/design-system.md)** -- Visual spec, colors, typography, layout rules
- **[docs/features/](../docs/features/)** -- Feature specs (inventory, pricing, search, finix, returns)

Before implementing a feature, read the relevant spec in `docs/features/`.

## Documentation Workflow -- Mandatory

These steps are required for every code change, not suggestions:

1. **New feature:** Create spec in `docs/features/<name>.md`, add to `docs/README.md` index
2. **Modified feature:** Update the corresponding spec in `docs/features/`
3. **New tests:** Write unit tests (>= 80% coverage) + E2E tests for UI workflows
4. **After E2E changes:** Run `update-test-docs` agent to sync `docs/tests/`
5. **New IPC/types/stores:** Update `docs/ai/repo-map.md` and relevant AI maps

## Testing and Coverage Gate

For every code change:

1. Run unit tests and coverage: `npm run test:coverage`
2. Coverage must remain **>= 80%** for statements, branches, functions, and lines
3. If coverage drops below 80%: add/update tests first, re-run, do not finalize until passing
4. If tests fail: fix the implementation or tests and re-run until green

## Quality Commands

Run in this order before finalizing:

1. `npx prettier --write .`
2. `npm run lint`
3. `npx stylelint "src/**/*.css"`
4. `npm run typecheck`
5. `npm run test:coverage`
6. `npm run test:e2e` (for UI flow changes)

## Supabase CLI — Use This for All Cloud DB Work

The Supabase CLI (`npx supabase`) is installed. **Use it directly** — do not ask the user to run SQL manually in the Supabase portal.

```bash
# Link project to remote (run once if not yet linked)
npx supabase link --project-ref <ref>   # ref from: app.supabase.com/project/<ref>

# Execute SQL against the remote DB
npx supabase db execute --remote --sql "SELECT * FROM merchant_products LIMIT 5;"

# Create and push migrations
npx supabase migration new <name>
npx supabase db push

# Pull remote schema / diff
npx supabase db pull
npx supabase db diff --use-migra
```

- Always use `npx supabase db execute --remote` to inspect or verify — never ask the user to go to the portal
- Schema changes go through `supabase/migrations/` files committed to the repo
- RLS policies and table definitions belong in migration files, not applied manually

## Multi-Agent Routing

Delegate specialized tasks to subagents when available:

- Use `test-engineer` for writing or updating Vitest/Playwright tests
- After test changes, run `update-test-docs` to sync `docs/tests/`
- Use `Explore` for fast read-only codebase discovery before implementation

Routing rules:

1. If a task is primarily testing, invoke `test-engineer` first
2. If tests were added or updated, invoke `update-test-docs` immediately after
3. If requirements are unclear, invoke `Explore` for quick mapping, then continue

## Scope

- Prefer focused unit tests for renderer logic when implementing UI behavior
- Keep tests deterministic and independent from external services
- For TDD on UI workflows, add/update Playwright tests in `tests/e2e/` before or with UI implementation

## Visual Verification

Before finalizing any UI-related change:

1. Open the app UI in the browser to visually verify the result
2. Check that text is readable, layouts are correct, and interactive elements work
3. If the change affects dark-background panels, confirm contrast and token usage
4. Do not mark a UI task as complete until you have visually confirmed the output
