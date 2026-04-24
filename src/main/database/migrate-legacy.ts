import Database from 'better-sqlite3'
import { existsSync, mkdirSync, renameSync } from 'fs'
import { dirname, join } from 'path'
import { scoped } from '../services/logger'

const log = scoped('legacy-db')

type LegacyMerchantRow = {
  merchant_account_id?: string | null
  merchant_id?: string | null
}

export function migrateLegacyDbIfPresent(options: {
  userDataPath: string
  merchantAccountId: string
  finixMerchantId?: string | null
}): string | null {
  const legacyPath = join(options.userDataPath, 'data', 'liquor-pos.db')
  const targetPath = join(
    options.userDataPath,
    'merchants',
    options.merchantAccountId,
    'database.sqlite'
  )

  if (!existsSync(legacyPath) || existsSync(targetPath)) {
    return existsSync(targetPath) ? targetPath : null
  }

  const legacyDb = new Database(legacyPath, { readonly: true })

  try {
    const columns = legacyDb.pragma('table_info(merchant_config)') as Array<{ name: string }>
    if (columns.length === 0) return null

    const hasMerchantAccountId = columns.some((column) => column.name === 'merchant_account_id')
    const selectSql = hasMerchantAccountId
      ? 'SELECT merchant_account_id, merchant_id FROM merchant_config WHERE id = 1'
      : 'SELECT merchant_id FROM merchant_config WHERE id = 1'

    const row = legacyDb.prepare(selectSql).get() as LegacyMerchantRow | undefined
    if (!row) return null

    const matchesAccountId = row.merchant_account_id === options.merchantAccountId
    const matchesFinixId =
      !!options.finixMerchantId && !!row.merchant_id && row.merchant_id === options.finixMerchantId

    if (!matchesAccountId && !matchesFinixId) return null
  } finally {
    legacyDb.close()
  }

  mkdirSync(dirname(targetPath), { recursive: true })
  // renameSync is safe here: legacyPath and targetPath both live under
  // Electron's userData directory, which is always a single filesystem root.
  renameSync(legacyPath, targetPath)
  log.info(`migrated legacy DB to ${targetPath}`)
  return targetPath
}
