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
4. `npm run test:e2e` (for UI flow changes)

## Scope

- Prefer focused unit tests for renderer logic (`store`, `components`, `pages`) when implementing UI behavior.
- Keep tests deterministic and independent from external services.
- For TDD on UI workflows, add/update Playwright tests in `tests/e2e` before or with UI implementation.

## Visual Verification

Before finalizing any UI-related change:

1. Open the app UI in the browser (Simple Browser or `open_simple_browser`) to visually verify the result.
2. Check that text is readable, layouts are correct, and interactive elements work as expected.
3. If the change affects dark-background panels, confirm contrast and color token usage (e.g. `--text-on-dark` for text on dark surfaces).
4. Do not mark a UI task as complete until you have visually confirmed the output.
