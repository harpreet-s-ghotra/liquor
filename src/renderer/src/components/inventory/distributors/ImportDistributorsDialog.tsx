import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { AppButton } from '@renderer/components/common/AppButton'
import { AppModalHeader } from '@renderer/components/common/AppModalHeader'
import { ImportIcon } from '@renderer/components/common/modal-icons'
import { useDebounce } from '@renderer/hooks/useDebounce'
import { stripIpcPrefix } from '@renderer/utils/ipc-error'
import type { CatalogDistributor } from '@renderer/types/pos'
import type { Distributor } from '../../../../../shared/types'
import './import-distributors-dialog.css'

type ImportDistributorsDialogProps = {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

export function ImportDistributorsDialog({
  isOpen,
  onClose,
  onImportComplete
}: ImportDistributorsDialogProps): React.JSX.Element {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="import-distributors-dialog"
        aria-label="Import Distributors"
        aria-describedby={undefined}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {isOpen && (
          <ImportDistributorsContent onClose={onClose} onImportComplete={onImportComplete} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ImportDistributorsContent({
  onClose,
  onImportComplete
}: {
  onClose: () => void
  onImportComplete: () => void
}): React.JSX.Element {
  const [distributors, setDistributors] = useState<CatalogDistributor[] | null>(null)
  const [localDistributors, setLocalDistributors] = useState<Distributor[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [showImportedOnly, setShowImportedOnly] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 200)

  useEffect(() => {
    let active = true

    Promise.all([window.api!.getCatalogDistributors(), window.api!.getDistributors()])
      .then(([catalog, local]) => {
        if (!active) return
        setDistributors(catalog)
        setLocalDistributors(local)
      })
      .catch((err) => {
        if (!active) return
        setLoadError(
          err instanceof Error ? stripIpcPrefix(err.message) : 'Failed to load distributors'
        )
        setDistributors([])
      })

    return () => {
      active = false
    }
  }, [])

  const importedNames = useMemo(
    () => new Set(localDistributors.map((d) => d.distributor_name).filter(Boolean)),
    [localDistributors]
  )

  const filtered = useMemo(() => {
    if (!distributors) return []
    let list = distributors
    if (showImportedOnly) list = list.filter((d) => importedNames.has(d.distributor_name))
    if (!debouncedSearch.trim()) return list
    const q = debouncedSearch.toLowerCase()
    return list.filter(
      (d) =>
        d.distributor_name.toLowerCase().includes(q) ||
        (d.county?.toLowerCase().includes(q) ?? false)
    )
  }, [distributors, debouncedSearch, showImportedOnly, importedNames])

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
      setTimeout(() => {
        onImportComplete()
        onClose()
      }, 1200)
    } catch (err) {
      setImportError(err instanceof Error ? stripIpcPrefix(err.message) : 'Import failed')
      setImportProgress(null)
      setImporting(false)
    }
  }, [selected, onImportComplete, onClose])

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((d) => selected.has(d.distributor_id))

  return (
    <>
      <DialogTitle className="dialog__sr-only">Import Distributors dialog</DialogTitle>
      <AppModalHeader
        icon={<ImportIcon />}
        label="Catalog"
        title="Import Distributors"
        onClose={onClose}
      />
      <DialogDescription className="import-distributors-dialog__description">
        Select distributors to import their products into your inventory.
      </DialogDescription>

      <div className="import-distributors-dialog__search-row">
        <input
          type="text"
          className="import-distributors-dialog__search"
          placeholder="Search distributors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={importing}
        />
        {distributors !== null && (
          <span className="import-distributors-dialog__count">{selected.size} selected</span>
        )}
      </div>

      {distributors !== null && importedNames.size > 0 && (
        <label className="import-distributors-dialog__filter-row">
          <input
            type="checkbox"
            checked={showImportedOnly}
            onChange={(e) => setShowImportedOnly(e.target.checked)}
            disabled={importing}
            className="import-distributors-dialog__checkbox"
          />
          <span className="import-distributors-dialog__filter-label">
            Show previously imported only ({importedNames.size})
          </span>
        </label>
      )}

      {loadError && <div className="import-distributors-dialog__error">{loadError}</div>}

      {distributors === null ? (
        <div className="import-distributors-dialog__loading">Loading distributors...</div>
      ) : (
        <>
          {filtered.length > 0 && (
            <div className="import-distributors-dialog__select-all">
              <label className="import-distributors-dialog__row">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  disabled={importing}
                  className="import-distributors-dialog__checkbox"
                />
                <span className="import-distributors-dialog__row-name import-distributors-dialog__row-name--all">
                  Select all visible ({filtered.length})
                </span>
              </label>
            </div>
          )}

          <div className="import-distributors-dialog__list">
            {filtered.length === 0 ? (
              <p className="import-distributors-dialog__empty">
                No distributors match your search.
              </p>
            ) : (
              filtered.map((d) => (
                <label key={d.distributor_id} className="import-distributors-dialog__row">
                  <input
                    type="checkbox"
                    checked={selected.has(d.distributor_id)}
                    onChange={() => toggleDistributor(d.distributor_id)}
                    disabled={importing}
                    className="import-distributors-dialog__checkbox"
                  />
                  <span className="import-distributors-dialog__row-name">{d.distributor_name}</span>
                  <span className="import-distributors-dialog__row-id">#{d.distributor_id}</span>
                  {d.county && (
                    <span className="import-distributors-dialog__row-meta">{d.county}</span>
                  )}
                  {d.post_type && (
                    <span className="import-distributors-dialog__row-tag">{d.post_type}</span>
                  )}
                  {importedNames.has(d.distributor_name) && (
                    <span className="import-distributors-dialog__row-tag import-distributors-dialog__row-tag--imported">
                      Imported
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
        </>
      )}

      {importProgress && (
        <div className="import-distributors-dialog__progress">{importProgress}</div>
      )}
      {importError && <div className="import-distributors-dialog__error">{importError}</div>}

      <div className="import-distributors-dialog__actions">
        <AppButton
          variant="success"
          size="md"
          onClick={() => void handleImport()}
          disabled={selected.size === 0 || importing}
        >
          {importing ? 'Importing...' : `Import ${selected.size > 0 ? `(${selected.size})` : ''}`}
        </AppButton>
        <AppButton variant="neutral" size="md" onClick={onClose} disabled={importing}>
          Cancel
        </AppButton>
      </div>
    </>
  )
}
