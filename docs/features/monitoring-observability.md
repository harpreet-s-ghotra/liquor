# Monitoring & Observability

## Status

Active

## Goal

Provide lightweight, local-first monitoring for launch so UI bugs and backend failures can be diagnosed quickly without adding noticeable runtime overhead. Covers two separate systems that coexist:

- **Telemetry** — structured, sampled events (errors, performance, behavior) for dashboards and funnel analysis.
- **Logging** — human-readable text stream for dev iteration, support, and crash triage.

## Scope

### Included

- Main-process telemetry service that buffers events and writes JSONL logs under userData.
- Renderer-to-main telemetry channel (`telemetry:track`) for behavior/performance/error events.
- Automatic IPC call timing/error tracking in preload for all `window.api` requests.
- Global renderer error capture (`error`, `unhandledrejection`) in app root.
- Startup performance markers (`app_startup_begin`, `app_startup_ready_to_show`).
- Lightweight controls: sampling, queue cap, payload sanitization/redaction.
- Dev-mode renderer console telemetry visibility for faster QA/debug loops.
- Sales History telemetry events for modal open, pagination behavior, and page-load results.

### Not Included (initial phase)

- Remote telemetry ingestion endpoint.
- Full distributed tracing.
- Session replay.

## Architecture

```
Renderer events/errors
  -> window.api.trackEvent(...)
  -> IPC: telemetry:track
  -> Main telemetry service
  -> local queue + periodic flush
  -> userData/telemetry/events.jsonl

In development mode, telemetry events are also mirrored to the renderer console as:

`[telemetry] <type> <name> <payload>`

This is a debug aid only; storage remains local JSONL.
```

## Event Model

`TelemetryEventInput`

- `type`: `error | performance | behavior | system`
- `name`: stable event name
- `payload`: optional key/value metadata (sanitized)
- `sampleRate`: optional per-event override

## Sampling and Performance Controls

- Errors are always captured.
- Performance events default to 10% sample rate.
- Queue capped to 2000 events (oldest dropped).
- Flush interval: 30 seconds.
- Immediate flush for errors and larger batches.
- Payload is redacted for sensitive keys (`password`, `token`, `cvv`, `card`, `pan`).

## Files

- `src/main/services/telemetry.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/App.tsx`
- `src/shared/types/index.ts`

## Next Iterations

1. Add an optional remote upload worker with retry/backoff.
2. Add release-health dashboard (error rate, startup p95, IPC p95).
3. Add workflow funnel events for checkout and purchase-order completion.

---

## Logging

Operational text-stream logging sits alongside telemetry but is strictly separate. Logging captures verbose human-readable diagnostics; telemetry captures structured sampled events.

### Goal

Produce a durable, scoped log stream so cloud-sync stalls, IPC failures, renderer crashes, and startup regressions can be diagnosed from `${userData}/logs/main.log` without rerunning the app.

### Scope

- File-backed log under `${userData}/logs/main.log`.
- Main, preload, and renderer processes all route through the same file.
- Scoped loggers per module (`sync-worker`, `ipc`, `supabase`, `pos-screen`, `deep-link`, …).
- IPC handler wrapper (`handle(channel, fn)` in `src/main/index.ts`) logs duration and errors for every channel.
- Sync worker drain entry/exit timing and per-item failure logs.
- Global `uncaughtException`, `unhandledRejection`, `render-process-gone`, and `child-process-gone` hooks.
- Native crashes captured to `${userData}/Crashes` via Electron `crashReporter` (local only, never uploaded).
- Sensitive keys redacted via the shared helper in `src/shared/redact.ts`.

### Architecture

```
Main process              -> electron-log/main     -> ${userData}/logs/main.log
Preload IPC wrapper       -> electron-log/preload  -> forwarded to main transport
Renderer (window.* errors)-> electron-log/renderer -> forwarded to main transport
```

Logger is initialized at startup from `src/main/services/logger.ts`. The renderer bootstraps in `src/renderer/src/main.tsx` by importing `./lib/logger`, which binds `electron-log/renderer` to forward all levels to the main transport.

### Levels

| Level | Use |
|-------|-----|
| `error` | Uncaught exceptions, IPC failures, sync item failures, renderer crashes |
| `warn`  | Recoverable failures, retry attempts, degraded paths (e.g. offline) |
| `info`  | Startup markers, sync drain start/end, deep-link events, state transitions |
| `debug` | IPC timing per call, per-item sync processing. Off in production. |

### Rotation

- Max size per file: 5 MB.
- electron-log default: keeps the previous file as `main.old.log` on rollover.

### Redaction

- Shared regex in `src/shared/redact.ts`: `/password|pin|token|secret|card|pan|cvv|bearer/i`.
- Keys matching any fragment (case-insensitive) are replaced with `'[REDACTED]'` before writing.
- Applies to both logger payloads and telemetry payload sanitization (`src/main/services/telemetry.ts`).
- Error instances pass through unredacted so stack traces stay intact — never log raw request bodies containing secrets.

### Config

- `LOG_LEVEL` env var overrides both file and console transports. Valid: `error | warn | info | debug`. Default `info`.
- Example: `LOG_LEVEL=debug npm run dev` to see IPC timing and sync-worker detail.

### Relationship to Telemetry

- Telemetry = structured events for dashboards. Sampled. JSONL storage. Flushed in batches.
- Logging = unstructured text for humans. Unsampled. Line-based. Streams in real time.
- Both use the same redaction helper so sensitive keys never leak.
- When a renderer error fires, it is captured once by telemetry (event) and once by the logger (text line) via the handlers in `src/renderer/src/App.tsx`.

### Files

- `src/main/services/logger.ts` (main-process init + `scoped(name)` factory)
- `src/renderer/src/lib/logger.ts` (renderer-process `scoped(name)` wrapper)
- `src/shared/redact.ts` (shared redaction regex and deep-clone masker)
- `src/main/services/logger.test.ts` (redaction behavior coverage)
- IPC wrapper and error sinks in `src/main/index.ts`
- Scoped logger adoption in:
  - `src/main/services/sync-worker.ts`
  - `src/main/services/sync/initial-sync.ts`
  - `src/main/services/supabase.ts`
  - `src/main/services/auto-updater.ts`
  - `src/renderer/src/App.tsx`
  - `src/renderer/src/store/usePosScreen.ts`
  - `src/preload/index.ts`

### Next Iterations

1. Optional remote log shipping worker (mirrors telemetry shape but for text).
2. `/logs` support bundle command that zips the last N rotated log files plus `${userData}/Crashes/`.
3. Log-level override from an in-app settings toggle instead of env var only.
