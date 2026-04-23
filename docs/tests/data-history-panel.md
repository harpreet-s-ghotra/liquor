# Data History Panel Component Tests

**File:** `src/renderer/src/components/manager/history/DataHistoryPanel.test.tsx`

## Overview

Focused renderer-unit coverage for the Manager modal Data History panel. The test verifies that the backfill-status subscription registered on mount is properly disposed when the panel unmounts.

## Test Setup

The test mocks `window.api` with:

- `getLocalHistoryStats()` — Returns local transaction count and date range
- `getBackfillStatus()` — Returns idle backfill state
- `triggerBackfill()` — Returns a started response for manual backfill requests
- `onBackfillStatusChanged()` — Returns the dispose callback used for cleanup assertions

## Test Suite

### Lifecycle cleanup (1 test)

- **cleans up the backfill status listener on unmount** — Waits for `onBackfillStatusChanged()` to be registered, unmounts the component, and verifies the returned dispose function is called.

## Mock Data

- **Local history stats** — 12 transactions from 2026-01-01 through 2026-02-01
- **Backfill status** — Idle state, 365-day window, no applied/skipped/error counts

## Coverage

This test covers the subscription lifecycle that keeps the Data History panel from leaking backfill listeners across modal opens and closes.
