# Auto-Update for LiquorPOS

## Context

The app has no auto-update mechanism. When a new version is released, merchants have no way to know or install it. The goal is "iPhone-style" updates: the app silently checks for updates, shows a non-intrusive banner, and lets the merchant download and install when convenient -- never interrupting an active transaction.

**Key constraint:** The source repo is private. `electron-updater` can't fetch releases from it without a token. Releases are published to the **public** repo `harpreet-s-ghotra/checkoutmain-releases`, so the updater must be configured to check there.

## Packaging Scope

Production builds should only ship the compiled Electron app from `out/` plus the runtime `package.json` metadata and production dependencies resolved by `electron-builder`.

Do not ship workspace-only folders such as `data/`, `docs/`, `tests/`, `coverage/`, `playwright-report/`, `test-results/`, `tools/`, `scripts/`, `schemas/`, `supabase/`, or source files from `src/`. Broad include rules noticeably increase Windows installer size.

---

## Steps

### Step 1: Fix CI to publish `latest.yml`

`electron-updater` requires a `latest.yml` metadata file in the GitHub release assets. The current workflow only uploads `*.exe`.

**File:** `.github/workflows/release.yml` (line 39)

Change `dist/*.exe` to `dist/*.exe dist/latest.yml` in the `gh release create` command.

### Step 2: Install electron-updater

```
npm install electron-updater
```

Must be in `dependencies` (not devDependencies) -- it runs at runtime in the packaged app.

### Step 3: Create auto-updater service

**Create:** `src/main/services/auto-updater.ts`

- Import `autoUpdater` from `electron-updater`
- `setFeedURL` to point at the **public** repo (`harpreet-s-ghotra/checkoutmain-releases`)
- `autoDownload = false` (merchant must opt in)
- `autoInstallOnAppQuit = true` (installs on next quit if downloaded)
- Forward events to renderer via `BrowserWindow.webContents.send()`:
  - `updater:update-available` -> `{ version, releaseDate }`
  - `updater:download-progress` -> `{ percent, transferred, total }`
  - `updater:update-downloaded` -> `{ version }`
  - `updater:error` -> `{ message }` (logged, not shown to user)
- Export: `initAutoUpdater()`, `checkForUpdates()`, `downloadUpdate()`, `installUpdate()`

### Step 4: Wire into main process

**File:** `src/main/index.ts`

- Import and call `initAutoUpdater()` inside `app.whenReady()` block (after `startConnectivityMonitor()` at line 172)
- Add delayed check: `setTimeout(() => checkForUpdates(), 10_000)` + `setInterval` every 4 hours, guarded by `!is.dev`
- Add 2 IPC handlers:
  - `ipcMain.handle('updater:download', ...)` -> calls `downloadUpdate()`
  - `ipcMain.handle('updater:install', ...)` -> calls `installUpdate()`

### Step 5: Preload bridge

**File:** `src/preload/index.ts` -- add 6 methods to the `api` object:

- `onUpdateAvailable(callback)` -- `ipcRenderer.on('updater:update-available', ...)`
- `onUpdateDownloadProgress(callback)` -- `ipcRenderer.on('updater:download-progress', ...)`
- `onUpdateDownloaded(callback)` -- `ipcRenderer.on('updater:update-downloaded', ...)`
- `onUpdateError(callback)` -- `ipcRenderer.on('updater:error', ...)`
- `downloadUpdate()` -- `ipcRenderer.invoke('updater:download')`
- `installUpdate()` -- `ipcRenderer.invoke('updater:install')`

**File:** `src/preload/index.d.ts` -- add matching type declarations after the Cloud Sync section (line 174)

### Step 6: UpdateBanner component

**Create:** `src/renderer/src/components/common/UpdateBanner.tsx`

A banner (not a modal) that sits below HeaderBar. Uses local React state with phases:

- `idle` -- hidden
- `available` -- "Version X.X.X is available" + **Download** button + dismiss X
- `downloading` -- "Downloading update... N%" + progress bar
- `ready` -- "Version X.X.X is ready to install" + **Install and Restart** button + dismiss X
- `error` -- silent, reverts to idle (retries on next interval)

Uses existing `AppButton` component. Dismissible so it doesn't block the merchant during a rush. Re-shows when download completes even if previously dismissed.

**Create:** `src/renderer/src/components/common/update-banner.css`

BEM styles using existing design tokens (`--accent-blue`, `--bg-input`, `--text-primary`, `--radius`).

### Step 7: Mount in POSScreen

**File:** `src/renderer/src/pages/POSScreen.tsx`

Add `<UpdateBanner />` between `<HeaderBar>` and `<AlertBar>`.

### Step 8: Dev testing config

**Create:** `dev-app-update.yml` at repo root (already excluded from production builds by electron-builder.yml):

```yaml
provider: github
owner: harpreet-s-ghotra
repo: checkoutmain-releases
```

---

## Files

| File                                                   | Action                                           |
| ------------------------------------------------------ | ------------------------------------------------ |
| `.github/workflows/release.yml`                        | Modify -- add `latest.yml` to public repo upload |
| `package.json`                                         | Modify -- add `electron-updater` dependency      |
| `src/main/services/auto-updater.ts`                    | Create -- updater service                        |
| `src/main/index.ts`                                    | Modify -- init updater, add 2 IPC handlers       |
| `src/preload/index.ts`                                 | Modify -- add 6 bridge methods                   |
| `src/preload/index.d.ts`                               | Modify -- add 6 type declarations                |
| `src/renderer/src/components/common/UpdateBanner.tsx`  | Create -- banner UI                              |
| `src/renderer/src/components/common/update-banner.css` | Create -- banner styles                          |
| `src/renderer/src/pages/POSScreen.tsx`                 | Modify -- mount UpdateBanner                     |
| `dev-app-update.yml`                                   | Create -- dev testing config                     |

---

## How It Works End-to-End

1. Dev pushes `git tag v1.1.0 && git push --tags`
2. CI builds Windows installer, publishes `.exe` + `latest.yml` to `checkoutmain-releases`
3. Merchant's running app (v1.0.0) checks `checkoutmain-releases` releases every 4 hours (and on launch)
4. `electron-updater` compares `latest.yml` version against `app.getVersion()`, finds v1.1.0 > v1.0.0
5. Banner appears: "Version 1.1.0 is available" with Download button
6. Merchant clicks Download when convenient (not during a transaction)
7. Progress bar shows download progress
8. Banner changes to: "Version 1.1.0 is ready to install" with Install and Restart button
9. Merchant clicks Install and Restart (or the update installs automatically on next app quit)

---

## Verification

1. `npm run typecheck` passes
2. `npm run lint` passes
3. Package the app locally with `npm run build:win`, confirm `latest.yml` exists in `dist/`
4. End-to-end: set package.json version to `0.0.1`, build, launch, confirm banner appears for the latest release on the public repo
