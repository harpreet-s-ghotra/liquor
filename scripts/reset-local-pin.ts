/**
 * Recovery script: reset local cashier PINs when the reconciler has
 * overwritten `pin_hash` with a value you don't know.
 *
 * Writes to local SQLite only. Does NOT touch Supabase. The next time the
 * sync-worker runs, LWW on `updated_at` will push the new pin_hash up to
 * `merchant_cashiers` because we bump updated_at here.
 *
 * Usage:
 *   npx tsx scripts/reset-local-pin.ts                        # reset ALL admin PINs to 0000
 *   npx tsx scripts/reset-local-pin.ts --pin 1234             # reset ALL admin PINs to 1234
 *   npx tsx scripts/reset-local-pin.ts --name Alice --pin 9999  # only Alice
 *
 * Close the POS app before running so the DB isn't locked.
 */

import Database from 'better-sqlite3'
import * as bcrypt from 'bcrypt'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

function readArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null
}

const newPin = readArg('--pin') ?? '0000'
const onlyName = readArg('--name')

if (!/^\d{4}$/.test(newPin)) {
  console.error('--pin must be exactly 4 digits')
  process.exit(1)
}

// Electron uses package.json "name" for its userData folder, not the project dir.
const APP_NAME = 'high-spirits-pos'
const LOCAL_APP_DIR =
  process.platform === 'win32'
    ? join(process.env['APPDATA'] ?? homedir(), APP_NAME)
    : join(homedir(), 'Library', 'Application Support', APP_NAME)

const LOCAL_DB_PATH = join(LOCAL_APP_DIR, 'data', 'liquor-pos.db')

if (!existsSync(LOCAL_DB_PATH)) {
  console.error(`Local DB not found at ${LOCAL_DB_PATH}`)
  process.exit(1)
}

async function main(): Promise<void> {
  const db = new Database(LOCAL_DB_PATH)
  db.pragma('foreign_keys = ON')

  const rows = db
    .prepare(
      onlyName
        ? 'SELECT id, name, role FROM cashiers WHERE is_active = 1 AND LOWER(name) = LOWER(?)'
        : 'SELECT id, name, role FROM cashiers WHERE is_active = 1'
    )
    .all(onlyName ? [onlyName] : []) as { id: number; name: string; role: string }[]

  if (rows.length === 0) {
    console.error('No matching active cashiers found.')
    db.close()
    process.exit(1)
  }

  console.log(`Resetting PIN to "${newPin}" for ${rows.length} cashier(s):`)
  for (const r of rows) console.log(`  - ${r.name} (${r.role})`)
  console.log()

  const pinHash = await bcrypt.hash(newPin, 10)
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const stmt = db.prepare(
    `UPDATE cashiers
        SET pin_hash = ?, updated_at = ?
      WHERE id = ?`
  )
  const tx = db.transaction(() => {
    for (const r of rows) stmt.run(pinHash, now, r.id)
  })
  tx()

  console.log(`Done. Open the POS and log in with PIN ${newPin}.`)
  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
