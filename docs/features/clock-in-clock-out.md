# Clock In / Clock Out

> Register-level session tracking with end-of-day reporting.

## Overview

LiquorPOS tracks daily register sessions. A session starts automatically when the first cashier logs in (if no active session exists) and ends when someone explicitly clocks out. Clock-out requires PIN verification and produces an end-of-day report with full sales breakdown.

## Key Decisions

- **Register-level sessions** -- one session per business day, shared across all cashiers
- **Opening cash is always $0** -- no prompt or editable field needed
- **Auto-start immediately after clock-out** -- a new session is created automatically as soon as clock-out completes, so the register is always in a session and transactions are never orphaned
- **Historical reports viewable** -- clicking a closed session shows its read-only report
- **Logout is sleep mode** -- exiting POS does not end the session

## User Flow

1. **Session auto-start**: When a cashier logs in and no active session exists, one is created automatically (transparent to user). Additionally, after every clock-out the next session is auto-created immediately so transactions are never lost between shifts.
2. **F3 / "Clock In/Out" button**: Opens the Clock Out modal
3. **Session list**: Paginated table showing all sessions (most recent first, 25 per page)
   - Active session: highlighted with "Clock Out" button
   - Closed sessions: "View Report" button
4. **Clock Out**: Clicking "Clock Out" shows a PIN entry pad
   - Accepts the current cashier's PIN or any admin PIN
   - Unlimited retries
   - 4-digit PIN auto-submits
   - Keyboard input supported (0-9, Backspace, Escape)
5. **End-of-Day Report**: After successful PIN verification, the session is closed and the report displays:
   - Session info (date range, opened/closed by)
   - Sales by Department table
   - Payment Breakdown (Cash / Credit / Debit)
   - Summary (gross sales, tax collected, net sales, average transaction)
   - Refunds (count and total, only if refunds exist)
   - Cash Reconciliation (cash sales - cash refunds = expected cash)
6. **Print Report**: Generates a receipt-formatted PDF and prints via CUPS
7. **Close**: Dismisses the modal, returns to POS screen

## Database

### sessions table

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opened_by_cashier_id INTEGER NOT NULL,
  opened_by_cashier_name TEXT NOT NULL,
  closed_by_cashier_id INTEGER,
  closed_by_cashier_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  FOREIGN KEY (opened_by_cashier_id) REFERENCES cashiers(id),
  FOREIGN KEY (closed_by_cashier_id) REFERENCES cashiers(id)
);
```

### transactions.session_id

Transactions are linked to sessions via a `session_id` column (added via migration). Session ID is attached transparently in the repo layer -- the renderer doesn't need to know about it.

## IPC Channels

| Channel                 | Input                      | Returns             |
| ----------------------- | -------------------------- | ------------------- |
| `sessions:get-active`   | --                         | `Session \| null`   |
| `sessions:create`       | `CreateSessionInput`       | `Session`           |
| `sessions:close`        | `CloseSessionInput`        | `Session`           |
| `sessions:list`         | `limit?, offset?`          | `SessionListResult` |
| `sessions:report`       | `sessionId: number`        | `ClockOutReport`    |
| `sessions:print-report` | `PrintClockOutReportInput` | `void`              |

## Types

All types defined in `src/shared/types/index.ts`:

- `Session` -- session record
- `CreateSessionInput` -- cashier_id + cashier_name
- `CloseSessionInput` -- session_id + cashier_id + cashier_name
- `ClockOutReport` -- full aggregated report
- `DepartmentSalesRow` -- department name + count + total
- `PaymentMethodSalesRow` -- payment method + count + total
- `SessionListResult` -- sessions array + total_count
- `PrintClockOutReportInput` -- store_name + cashier_name + report

## File Map

| File                                                       | Purpose                                               |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `src/shared/types/index.ts`                                | Session and report types                              |
| `src/main/database/schema.ts`                              | sessions table DDL + transaction session_id migration |
| `src/main/database/sessions.repo.ts`                       | Session CRUD + report generation                      |
| `src/main/database/transactions.repo.ts`                   | Attaches session_id on save                           |
| `src/main/index.ts`                                        | 6 IPC handlers for sessions                           |
| `src/preload/index.ts` + `index.d.ts`                      | 6 window.api methods                                  |
| `src/main/services/receipt-printer.ts`                     | printClockOutReport function                          |
| `src/renderer/src/store/useAuthStore.ts`                   | Session auto-creation on login                        |
| `src/renderer/src/components/clock-out/ClockOutModal.tsx`  | Main modal (list/pin/report views)                    |
| `src/renderer/src/components/clock-out/ClockOutReport.tsx` | Presentational report component                       |
| `src/renderer/src/components/layout/BottomShortcutBar.tsx` | F3 wired to onClockOutClick                           |
| `src/renderer/src/pages/POSScreen.tsx`                     | State + F3 shortcut + render modal                    |

## Report Generation

The report aggregates data from transactions linked to the session:

1. **Sales by department**: JOIN transaction_items -> products -> departments, GROUP BY department
2. **Sales by payment method**: GROUP BY payment_method for completed transactions
3. **Aggregate totals**: COUNT, SUM(total), SUM(tax_amount) for completed transactions
4. **Refund totals**: COUNT, SUM(total) for status='refund'
5. **Cash breakdown**: SUM of cash sales, SUM of cash refunds

Derived values:

- `net_sales = gross_sales - total_tax_collected`
- `average_transaction_value = gross_sales / count || 0`
- `expected_cash_at_close = cash_sales - cash_refunds`

## Edge Cases

- **Pre-migration transactions**: Existing transactions have `session_id = NULL` and won't appear in any session report. Old data remains accessible via Sales History.
- **App crash**: Active session persists in DB. Next launch finds it via `getActiveSession()` and resumes normally.
- **Multiple active sessions**: `createSession()` throws if an active session already exists.
- **Products without departments**: Grouped under "Uncategorized" in the report.
- **Timestamps**: SQLite `CURRENT_TIMESTAMP` stores UTC without a timezone marker. All repo functions normalize these to proper ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`) via `normalizeTimestamp()` in `src/main/database/utils.ts` so `new Date()` always parses them as UTC. Sales History date filters are converted to SQLite format before comparison via `toSqliteFormat()` in the same file.
