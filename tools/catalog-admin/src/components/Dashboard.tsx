import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Merchant, DiffRow, FilterMode } from '../types'
import { fetchMerchants, fetchMerchantProducts, fetchCatalogProductsByTtbIds } from '../lib/api'
import { computeDiffRows, buildCatalogMap } from '../lib/diff'
import DiffTable from './DiffTable'

type LoadPhase = 'idle' | 'loading' | 'loaded' | 'error'

type Props = {
  user: User
  onSignOut: () => void
}

export default function Dashboard({ user, onSignOut }: Props): React.JSX.Element {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [merchantsError, setMerchantsError] = useState<string | null>(null)

  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('')
  const [merchantSearch, setMerchantSearch] = useState('')

  const [diffRows, setDiffRows] = useState<DiffRow[]>([])
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadStats, setLoadStats] = useState<{ products: number; withDiffs: number } | null>(null)

  const [filter, setFilter] = useState<FilterMode>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  // Load merchant list on mount
  useEffect(() => {
    fetchMerchants()
      .then(setMerchants)
      .catch((err) => setMerchantsError(err instanceof Error ? err.message : String(err)))
  }, [])

  // Load diff data when merchant changes
  const loadDiffs = useCallback(async (merchantId: string) => {
    setLoadPhase('loading')
    setLoadError(null)
    setDiffRows([])
    setLoadStats(null)
    setPage(1)

    try {
      const merchantProducts = await fetchMerchantProducts(merchantId)

      const ttbIds = [...new Set(merchantProducts.map((p) => p.ttb_id).filter(Boolean) as string[])]
      const catalogProducts = await fetchCatalogProductsByTtbIds(ttbIds)

      const catalogMap = buildCatalogMap(catalogProducts)
      const rows = computeDiffRows(merchantProducts, catalogMap)

      const productsWithDiffs = new Set(rows.map((r) => r.merchant_product_id)).size
      setLoadStats({ products: merchantProducts.length, withDiffs: productsWithDiffs })
      setDiffRows(rows)
      setLoadPhase('loaded')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
      setLoadPhase('error')
    }
  }, [])

  function handleMerchantChange(id: string): void {
    setSelectedMerchantId(id)
    setFilter('all')
    setSearchQuery('')
    if (id) {
      loadDiffs(id)
    } else {
      setDiffRows([])
      setLoadPhase('idle')
      setLoadStats(null)
    }
  }

  // Refresh after a promote/clear action
  function handleRowMutated(): void {
    if (selectedMerchantId) {
      loadDiffs(selectedMerchantId)
    }
  }

  const selectedMerchant = merchants.find((m) => m.id === selectedMerchantId) ?? null
  const filteredMerchants = merchants.filter((m) =>
    m.merchant_name.toLowerCase().includes(merchantSearch.toLowerCase())
  )

  const trimmedSearch = searchQuery.trim().toLowerCase()
  const filteredRows = diffRows.filter((row) => {
    if (filter === 'no_match' && row.status !== 'no_catalog_match') return false
    if (filter === 'merchant_only' && row.status !== 'merchant_only') return false
    if (
      filter !== 'all' &&
      filter !== 'no_match' &&
      filter !== 'merchant_only' &&
      row.field !== filter
    ) {
      return false
    }

    if (trimmedSearch.length > 0) {
      const haystack = `${row.product_name ?? ''} ${row.merchant_sku ?? ''}`.toLowerCase()
      if (!haystack.includes(trimmedSearch)) return false
    }
    return true
  })

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard__header">
        <div className="dashboard__header-title">
          <span className="dashboard__header-app">Catalog Admin</span>
          <span className="dashboard__header-org">Checkoutmain &amp; Co.</span>
        </div>
        <div className="dashboard__header-user">
          <span className="dashboard__header-email">{user.email}</span>
          <button type="button" className="btn btn--neutral btn--sm" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {/* Merchant picker */}
      <div className="dashboard__toolbar">
        <div className="merchant-picker">
          <label className="field__label" htmlFor="merchant-search">
            Merchant
          </label>
          <div className="merchant-picker__row">
            <input
              id="merchant-search"
              type="search"
              className="field__input merchant-picker__search"
              placeholder="Search merchants…"
              value={merchantSearch}
              onChange={(e) => setMerchantSearch(e.target.value)}
            />
            <select
              className="field__input merchant-picker__select"
              value={selectedMerchantId}
              onChange={(e) => handleMerchantChange(e.target.value)}
            >
              <option value="">— Select a merchant —</option>
              {filteredMerchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.merchant_name}
                </option>
              ))}
            </select>
          </div>
          {merchantsError && <p className="field__error">{merchantsError}</p>}
        </div>

        {selectedMerchantId && (
          <div className="diff-search">
            <label className="field__label" htmlFor="diff-search">
              Search
            </label>
            <input
              id="diff-search"
              type="search"
              className="field__input diff-search__input"
              placeholder="Filter by name or SKU…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
            />
          </div>
        )}

        {loadStats && (
          <div className="dashboard__stats">
            <span>
              <strong>{loadStats.products}</strong> products
            </span>
            <span className="dashboard__stats-sep" />
            <span>
              <strong>{loadStats.withDiffs}</strong> with diffs
            </span>
            <span className="dashboard__stats-sep" />
            <span>
              <strong>{diffRows.length}</strong> total diff rows
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <main className="dashboard__body">
        {loadPhase === 'idle' && !selectedMerchantId && (
          <div className="dashboard__empty">Select a merchant to review catalog diffs.</div>
        )}

        {loadPhase === 'loading' && (
          <div className="dashboard__loading">
            <div className="app-loading__spinner" />
            <p>Loading products and catalog data…</p>
          </div>
        )}

        {loadPhase === 'error' && (
          <div className="dashboard__error">
            <strong>Failed to load data</strong>
            <p>{loadError}</p>
            <button
              type="button"
              className="btn btn--neutral btn--sm"
              onClick={() => loadDiffs(selectedMerchantId)}
            >
              Retry
            </button>
          </div>
        )}

        {loadPhase === 'loaded' && selectedMerchant && (
          <DiffTable
            rows={filteredRows}
            allRows={diffRows}
            filter={filter}
            onFilterChange={(f) => {
              setFilter(f)
              setSearchQuery('')
              setPage(1)
            }}
            page={page}
            onPageChange={setPage}
            selectedMerchantId={selectedMerchantId}
            operatorEmail={user.email ?? ''}
            onMutated={handleRowMutated}
          />
        )}
      </main>
    </div>
  )
}
