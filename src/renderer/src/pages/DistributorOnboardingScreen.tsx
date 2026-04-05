import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useDebounce } from '../hooks/useDebounce'
import { stripIpcPrefix } from '../utils/ipc-error'
import type { CatalogDistributor } from '../../../shared/types'
import './DistributorOnboardingScreen.css'

export function DistributorOnboardingScreen(): React.JSX.Element {
  const [distributors, setDistributors] = useState<CatalogDistributor[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)
  const debouncedSearch = useDebounce(search, 200)

  useEffect(() => {
    window
      .api!.getCatalogDistributors()
      .then(setDistributors)
      .catch((err) => {
        setLoadError(
          err instanceof Error ? stripIpcPrefix(err.message) : 'Failed to load distributors'
        )
        setDistributors([])
      })
  }, [])

  const filtered = useMemo(() => {
    if (!distributors) return []
    if (!debouncedSearch.trim()) return distributors
    const q = debouncedSearch.toLowerCase()
    return distributors.filter(
      (d) =>
        d.distributor_name.toLowerCase().includes(q) ||
        String(d.distributor_id).includes(q) ||
        (d.county?.toLowerCase().includes(q) ?? false)
    )
  }, [distributors, debouncedSearch])

  const toggleDistributor = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (!filtered.length) return
    const allFilteredSelected = filtered.every((d) => selected.has(d.distributor_id))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filtered.forEach((d) => next.delete(d.distributor_id))
      } else {
        filtered.forEach((d) => next.add(d.distributor_id))
      }
      return next
    })
  }, [filtered, selected])

  const handleImport = useCallback(async () => {
    if (selected.size === 0) return
    setImporting(true)
    setImportError(null)
    setImportProgress(`Importing items from ${selected.size} distributor(s)...`)
    try {
      const result = await window.api!.importCatalogItems(Array.from(selected))
      setImportProgress(
        `Imported ${result.imported.toLocaleString()} items from ${result.distributors_created} new distributor(s).`
      )
      // Brief pause so user can see the success message
      setTimeout(() => completeOnboarding(), 1200)
    } catch (err) {
      setImportError(err instanceof Error ? stripIpcPrefix(err.message) : 'Import failed')
      setImportProgress(null)
      setImporting(false)
    }
  }, [selected, completeOnboarding])

  const handleSkip = useCallback(() => {
    completeOnboarding()
  }, [completeOnboarding])

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((d) => selected.has(d.distributor_id))

  return (
    <div className="dist-onboarding">
      <div className="dist-onboarding__card">
        <div className="dist-onboarding__header">
          <h1 className="dist-onboarding__brand">High Spirits POS</h1>
          <h2 className="dist-onboarding__title">Select Your Distributors</h2>
          <p className="dist-onboarding__description">
            Choose the distributors you work with. Their products will be imported into your
            inventory so you can set pricing right away.
          </p>
        </div>

        <div className="dist-onboarding__search-row">
          <input
            type="text"
            className="dist-onboarding__search"
            placeholder="Search distributors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={importing}
          />
          {distributors !== null && (
            <span className="dist-onboarding__count">{selected.size} selected</span>
          )}
        </div>

        {loadError && <div className="dist-onboarding__error">{loadError}</div>}

        {distributors === null ? (
          <div className="dist-onboarding__loading">Loading distributors...</div>
        ) : (
          <>
            {filtered.length > 0 && (
              <div className="dist-onboarding__select-all">
                <label className="dist-onboarding__row">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    disabled={importing}
                    className="dist-onboarding__checkbox"
                  />
                  <span className="dist-onboarding__row-name dist-onboarding__row-name--all">
                    Select all visible ({filtered.length})
                  </span>
                </label>
              </div>
            )}

            <div className="dist-onboarding__list">
              {filtered.length === 0 ? (
                <p className="dist-onboarding__empty">No distributors match your search.</p>
              ) : (
                filtered.map((d) => (
                  <label key={d.distributor_id} className="dist-onboarding__row">
                    <input
                      type="checkbox"
                      checked={selected.has(d.distributor_id)}
                      onChange={() => toggleDistributor(d.distributor_id)}
                      disabled={importing}
                      className="dist-onboarding__checkbox"
                    />
                    <span className="dist-onboarding__row-name">{d.distributor_name}</span>
                    <span className="dist-onboarding__row-meta">#{d.distributor_id}</span>
                    {d.county && <span className="dist-onboarding__row-meta">{d.county}</span>}
                    {d.post_type && <span className="dist-onboarding__row-tag">{d.post_type}</span>}
                  </label>
                ))
              )}
            </div>
          </>
        )}

        {importProgress && <div className="dist-onboarding__progress">{importProgress}</div>}
        {importError && <div className="dist-onboarding__error">{importError}</div>}

        <div className="dist-onboarding__actions">
          <button
            type="button"
            className="dist-onboarding__btn dist-onboarding__btn--primary"
            onClick={handleImport}
            disabled={selected.size === 0 || importing}
          >
            {importing ? 'Importing...' : `Import ${selected.size > 0 ? `(${selected.size})` : ''}`}
          </button>
          <button
            type="button"
            className="dist-onboarding__btn dist-onboarding__btn--secondary"
            onClick={handleSkip}
            disabled={importing}
          >
            Skip — add items manually later
          </button>
        </div>
      </div>
    </div>
  )
}
