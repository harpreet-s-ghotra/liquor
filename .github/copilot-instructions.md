# Copilot Instructions

## Testing & Coverage Gate

For every code change in this repository:

1. Run unit tests and coverage before finalizing:
   - `npm run test:coverage`
2. Coverage must remain **>= 80%** for statements, branches, functions, and lines.
3. If coverage drops below 80%:
   - Add or update unit tests first,
   - Re-run coverage,
   - Do not finalize until the threshold passes.
4. If tests fail, fix the implementation or tests and re-run until green.

## Quality Commands

Use this sequence during implementation:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:coverage`

## Scope

- Prefer focused unit tests for renderer logic (`store`, `components`, `pages`) when implementing UI behavior.
- Keep tests deterministic and independent from external services.
