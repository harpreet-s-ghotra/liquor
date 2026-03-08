import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { TabBar } from '@renderer/components/common/TabBar'
import type {
  InventoryProduct,
  InventoryProductDetail,
  InventoryTaxCode,
  SaveInventoryItemInput,
  SpecialPricingRule,
  Vendor
} from '@renderer/types/pos'
import { SKU_PATTERN, SKU_MAX_LENGTH, NAME_MAX_LENGTH } from '../../../../../shared/constants'
import {
  formatCurrency,
  normalizeCurrencyForInput,
  parseCurrencyDigitsToDollars
} from '@renderer/utils/currency'
import './item-form.css'

type SpecialPricingFormRow = {
  quantity: string
  price: string
  duration_days: string
}

type CaseDiscountMode = 'percent' | 'dollar'

type InventoryFormState = {
  item_number?: number
  sku: string
  item_name: string
  dept_ids: string[]
  vendor_number: string
  cost: string
  retail_price: string
  in_stock: string
  tax_rates: string[]
  special_pricing: SpecialPricingFormRow[]
  additional_skus: string[]
  bottles_per_case: string
  case_discount_price: string
  case_discount_mode: CaseDiscountMode
}

const emptyFormState: InventoryFormState = {
  sku: '',
  item_name: '',
  dept_ids: [],
  vendor_number: '',
  cost: '',
  retail_price: '',
  in_stock: '',
  tax_rates: [],
  special_pricing: [],
  additional_skus: [],
  bottles_per_case: '12',
  case_discount_price: '',
  case_discount_mode: 'percent'
}

const itemSubTabs = [
  { id: 'case-settings', label: 'Case & Quantity' },
  { id: 'additional-skus', label: 'Additional SKUs' },
  { id: 'special-pricing', label: 'Special Pricing' },
  { id: 'sales-history', label: 'Sales History' }
]

export function ItemForm(): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const [searchTerm, setSearchTerm] = useState('')
  const [, setInventoryItems] = useState<InventoryProduct[]>([])
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([])
  const [taxCodeOptions, setTaxCodeOptions] = useState<InventoryTaxCode[]>([])
  const [vendorOptions, setVendorOptions] = useState<Vendor[]>([])
  const [selectedItem, setSelectedItem] = useState<InventoryProductDetail | null>(null)
  const [formState, setFormState] = useState<InventoryFormState>(emptyFormState)
  const [additionalSkuInput, setAdditionalSkuInput] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('case-settings')
  const [taxDropdownOpen, setTaxDropdownOpen] = useState(false)
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false)

  const hasBackendApi =
    typeof api?.searchInventoryProducts === 'function' &&
    typeof api?.getInventoryProductDetail === 'function' &&
    typeof api?.saveInventoryItem === 'function' &&
    typeof api?.getInventoryDepartments === 'function' &&
    typeof api?.getInventoryTaxCodes === 'function' &&
    typeof api?.getVendors === 'function'

  const normalizedTaxRateOptions = useMemo(
    () => new Set(taxCodeOptions.map((option) => Number(option.rate.toFixed(4)))),
    [taxCodeOptions]
  )

  const isAllowedTaxRate = useCallback(
    (rawValue: string): boolean => {
      const parsedRate = Number.parseFloat(rawValue)
      if (Number.isNaN(parsedRate)) return false
      return normalizedTaxRateOptions.has(Number(parsedRate.toFixed(4)))
    },
    [normalizedTaxRateOptions]
  )

  const defaultFormState = useMemo<InventoryFormState>(() => {
    return {
      ...emptyFormState,
      dept_ids: [],
      tax_rates: []
    }
  }, [])

  const loadSearchResults = async (query: string): Promise<void> => {
    if (!hasBackendApi) {
      setErrorMessage(
        'Backend inventory API is unavailable. Please run the app via Electron (npm run dev).'
      )
      return
    }
    try {
      const results = await api.searchInventoryProducts(query)
      setInventoryItems(results)
      setErrorMessage(null)
    } catch {
      setErrorMessage('Unable to load inventory results.')
    }
  }

  useEffect(() => {
    if (!hasBackendApi) return

    let active = true

    void Promise.all([
      api.searchInventoryProducts(''),
      api.getInventoryDepartments(),
      api.getInventoryTaxCodes(),
      api.getVendors()
    ])
      .then(([results, departments, taxCodes, vendors]) => {
        if (!active) return
        setInventoryItems(results)
        setDepartmentOptions(departments)
        setTaxCodeOptions(taxCodes)
        setVendorOptions(vendors)
        setErrorMessage(null)
      })
      .catch(() => {
        if (!active) return
        setErrorMessage('Unable to load inventory results.')
      })

    return () => {
      active = false
    }
  }, [api, hasBackendApi])

  const applyDetailToForm = (detail: InventoryProductDetail): void => {
    const detailTaxRates =
      detail.tax_rates && detail.tax_rates.length > 0
        ? detail.tax_rates
        : [detail.tax_1, detail.tax_2].filter((taxRate) => Number.isFinite(taxRate) && taxRate >= 0)

    setSelectedItem(detail)
    setFormState({
      item_number: detail.item_number,
      sku: detail.sku,
      item_name: detail.item_name,
      dept_ids: detail.dept_id
        ? detail.dept_id
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean)
        : [],
      cost: formatCurrency(detail.cost),
      retail_price: formatCurrency(detail.retail_price),
      vendor_number: detail.vendor_number != null ? String(detail.vendor_number) : '',
      in_stock: String(detail.in_stock),
      tax_rates: Array.from(new Set(detailTaxRates.map((taxRate) => String(taxRate)))),
      special_pricing: (detail.special_pricing ?? []).map((rule) => ({
        quantity: String(rule.quantity),
        price: formatCurrency(rule.price),
        duration_days: String(rule.duration_days)
      })),
      additional_skus: [...detail.additional_skus],
      bottles_per_case: String(detail.bottles_per_case ?? 12),
      case_discount_price:
        detail.case_discount_price != null ? formatCurrency(detail.case_discount_price) : '',
      case_discount_mode:
        (detail.case_discount_price != null ? 'dollar' : 'percent') as CaseDiscountMode
    })
  }

  const handleNewItem = (): void => {
    setSelectedItem(null)
    setFormState(defaultFormState)
    setShowValidation(false)
    setSaveMessage(null)
    setErrorMessage(null)
    setActiveTab('case-settings')
  }

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {}

    if (!formState.sku.trim()) {
      errors.sku = 'SKU is required'
    } else if (!SKU_PATTERN.test(formState.sku.trim())) {
      errors.sku = 'SKU must contain only letters, numbers, and hyphens'
    } else if (formState.sku.trim().length > SKU_MAX_LENGTH) {
      errors.sku = `SKU must be ${SKU_MAX_LENGTH} characters or less`
    }

    if (!formState.item_name.trim()) {
      errors.item_name = 'Name is required'
    } else if (formState.item_name.trim().length > NAME_MAX_LENGTH) {
      errors.item_name = `Name must be ${NAME_MAX_LENGTH} characters or less`
    }

    if (
      formState.dept_ids.length > 0 &&
      departmentOptions.length > 0 &&
      formState.dept_ids.some((d) => !departmentOptions.includes(d))
    ) {
      errors.dept_id = 'Departments must be selected from available values'
    }

    if (!formState.cost.trim()) {
      errors.cost = 'Cost is required'
    }

    if (!formState.retail_price.trim()) {
      errors.retail_price = 'Price is required'
    }

    if (!formState.in_stock.trim()) {
      errors.in_stock = 'In stock is required'
    } else {
      const inStockValue = Number.parseInt(formState.in_stock, 10)
      if (!Number.isInteger(inStockValue)) {
        errors.in_stock = 'In stock must be an integer'
      }
    }

    if (
      formState.tax_rates.length > 0 &&
      taxCodeOptions.length > 0 &&
      formState.tax_rates.some((taxRate) => !isAllowedTaxRate(taxRate))
    ) {
      errors.tax_rates = 'Tax codes must be selected from backend values'
    }

    return errors
  }, [departmentOptions, formState, isAllowedTaxRate, taxCodeOptions.length])

  const hasFieldErrors = Object.keys(fieldErrors).length > 0

  const parsePayload = (): SaveInventoryItemInput | null => {
    const cost = parseCurrencyDigitsToDollars(formState.cost)
    const retailPrice = parseCurrencyDigitsToDollars(formState.retail_price)
    const inStock = Number.parseInt(formState.in_stock, 10)
    const taxRates = Array.from(
      new Set(
        formState.tax_rates
          .map((taxRate) => Number.parseFloat(taxRate))
          .filter((taxRate) => !Number.isNaN(taxRate))
      )
    )

    const specialPricing: SpecialPricingRule[] = formState.special_pricing
      .map((row) => ({
        quantity: Number.parseInt(row.quantity, 10),
        price: parseCurrencyDigitsToDollars(row.price),
        duration_days: Number.parseInt(row.duration_days, 10)
      }))
      .filter(
        (rule) =>
          Number.isInteger(rule.quantity) &&
          rule.quantity >= 1 &&
          Number.isFinite(rule.price) &&
          rule.price >= 0 &&
          Number.isInteger(rule.duration_days) &&
          rule.duration_days >= 1
      )

    if (Number.isNaN(cost) || Number.isNaN(retailPrice) || Number.isNaN(inStock)) {
      setErrorMessage('One or more numeric fields are invalid')
      return null
    }

    return {
      item_number: formState.item_number,
      sku: formState.sku.trim(),
      item_name: formState.item_name.trim(),
      dept_id: formState.dept_ids.join(', '),
      vendor_number: formState.vendor_number ? Number.parseInt(formState.vendor_number, 10) : null,
      cost,
      retail_price: retailPrice,
      in_stock: inStock,
      tax_rates: taxRates,
      special_pricing: specialPricing,
      additional_skus: formState.additional_skus,
      bottles_per_case: formState.bottles_per_case
        ? Number.parseInt(formState.bottles_per_case, 10)
        : 12,
      case_discount_price: (() => {
        if (!formState.case_discount_price) return null
        if (formState.case_discount_mode === 'percent') {
          // Percent off retail × bottles_per_case
          const pct = Number.parseFloat(formState.case_discount_price)
          if (Number.isNaN(pct) || pct <= 0) return null
          const bpc = formState.bottles_per_case
            ? Number.parseInt(formState.bottles_per_case, 10)
            : 12
          const fullCasePrice = retailPrice * bpc
          return Math.round(fullCasePrice * (1 - pct / 100) * 100) / 100
        }
        return parseCurrencyDigitsToDollars(formState.case_discount_price)
      })()
    }
  }

  const handleSave = async (): Promise<void> => {
    setSaveMessage(null)
    setShowValidation(true)

    if (!hasBackendApi) {
      setErrorMessage(
        'Backend inventory API is unavailable. Please run the app via Electron (npm run dev).'
      )
      return
    }

    if (hasFieldErrors) return

    const payload = parsePayload()
    if (!payload) return

    try {
      const savedDetail = await api.saveInventoryItem(payload)
      applyDetailToForm(savedDetail)
      await loadSearchResults(searchTerm)
      setShowValidation(false)
      setErrorMessage(null)
      setSaveMessage('Item saved')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save item')
    }
  }

  const handleSearch = async (): Promise<void> => {
    setSaveMessage(null)
    setErrorMessage(null)

    if (!hasBackendApi) {
      setErrorMessage(
        'Backend inventory API is unavailable. Please run the app via Electron (npm run dev).'
      )
      return
    }

    try {
      const results = await api.searchInventoryProducts(searchTerm)
      setInventoryItems(results)
      if (results.length > 0) {
        const detail = await api.getInventoryProductDetail(results[0].item_number)
        if (detail) {
          applyDetailToForm(detail)
          setShowValidation(false)
        }
      } else {
        setSelectedItem(null)
        setFormState(defaultFormState)
        setErrorMessage('No items found. You can enter a new item above.')
      }
    } catch {
      setErrorMessage('Unable to search inventory.')
    }
  }

  const toggleTaxRate = (rateValue: string): void => {
    setFormState((current) => {
      const exists = current.tax_rates.includes(rateValue)
      return {
        ...current,
        tax_rates: exists
          ? current.tax_rates.filter((r) => r !== rateValue)
          : [...current.tax_rates, rateValue]
      }
    })
  }

  const taxRateSummary = useMemo(() => {
    if (formState.tax_rates.length === 0) return 'Select tax codes...'
    return taxCodeOptions
      .filter((tc) => formState.tax_rates.includes(String(tc.rate)))
      .map((tc) => `${tc.code} (${(tc.rate * 100).toFixed(2)}%)`)
      .join(', ')
  }, [formState.tax_rates, taxCodeOptions])

  const toggleDepartment = (dept: string): void => {
    setFormState((current) => {
      const exists = current.dept_ids.includes(dept)
      return {
        ...current,
        dept_ids: exists ? current.dept_ids.filter((d) => d !== dept) : [...current.dept_ids, dept]
      }
    })
  }

  const deptSummary = useMemo(() => {
    if (formState.dept_ids.length === 0) return 'Select departments...'
    return formState.dept_ids.join(', ')
  }, [formState.dept_ids])

  const markupSuggestions = useMemo(() => {
    const costDigits = formState.cost.replace(/\D/g, '')
    if (!costDigits) return []
    const costDollars = Number.parseInt(costDigits, 10) / 100
    if (costDollars <= 0) return []
    return [20, 40].map((pct) => ({
      label: `+${pct}%`,
      price: costDollars * (1 + pct / 100)
    }))
  }, [formState.cost])

  const addAdditionalSku = (): void => {
    const trimmed = additionalSkuInput.trim()
    if (!trimmed) return
    if (formState.additional_skus.includes(trimmed)) {
      setAdditionalSkuInput('')
      return
    }
    setFormState((current) => ({
      ...current,
      additional_skus: [...current.additional_skus, trimmed]
    }))
    setAdditionalSkuInput('')
  }

  const removeAdditionalSku = (skuToRemove: string): void => {
    setFormState((current) => ({
      ...current,
      additional_skus: current.additional_skus.filter((sku) => sku !== skuToRemove)
    }))
  }

  const updateCurrencyField = (
    field: 'cost' | 'retail_price' | 'case_discount_price',
    value: string
  ): void => {
    setFormState((current) => ({
      ...current,
      [field]: normalizeCurrencyForInput(value)
    }))
  }

  const addSpecialPricingRow = (): void => {
    setFormState((current) => ({
      ...current,
      special_pricing: [...current.special_pricing, { quantity: '', price: '', duration_days: '' }]
    }))
  }

  const removeSpecialPricingRow = (index: number): void => {
    setFormState((current) => ({
      ...current,
      special_pricing: current.special_pricing.filter((_, i) => i !== index)
    }))
  }

  const updateSpecialPricingRow = (
    index: number,
    field: keyof SpecialPricingFormRow,
    value: string
  ): void => {
    setFormState((current) => ({
      ...current,
      special_pricing: current.special_pricing.map((row, i) =>
        i === index
          ? { ...row, [field]: field === 'price' ? normalizeCurrencyForInput(value) : value }
          : row
      )
    }))
  }

  return (
    <div className="item-form">
      {/* Header actions row */}
      <div className="item-form__actions">
        <AppButton size="md" onClick={handleNewItem}>
          New Item
        </AppButton>
        <AppButton
          size="md"
          variant="success"
          onClick={() => void handleSave()}
          disabled={showValidation && hasFieldErrors}
        >
          Save Item
        </AppButton>
      </div>

      {/* Required fields card */}
      <section className="item-form__required-section" aria-label="Required Information">
        <div className="item-form__required-grid">
          {/* Row 1: SKU | Name (span 3) | Department */}
          <FormField label="SKU" required error={fieldErrors.sku} showError={showValidation}>
            <ValidatedInput
              fieldType="sku"
              aria-label="SKU"
              value={formState.sku}
              onChange={(value) => setFormState((current) => ({ ...current, sku: value }))}
              placeholder="e.g. WINE-001"
            />
          </FormField>
          <FormField
            label="Name"
            required
            error={fieldErrors.item_name}
            showError={showValidation}
            className="item-form__col-span-3"
          >
            <ValidatedInput
              fieldType="name"
              aria-label="Name"
              value={formState.item_name}
              onChange={(value) => setFormState((current) => ({ ...current, item_name: value }))}
            />
          </FormField>
          <FormField label="Department" error={fieldErrors.dept_id} showError={showValidation}>
            <div className="dept-dropdown" aria-label="Department">
              <button
                type="button"
                className="ticket-input dept-dropdown-toggle"
                onClick={() => setDeptDropdownOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={deptDropdownOpen}
              >
                <span className="dept-dropdown-summary">{deptSummary}</span>
                <span className="dept-dropdown-caret" aria-hidden="true">
                  &#9662;
                </span>
              </button>
              {deptDropdownOpen && (
                <ul className="dept-dropdown-menu" role="listbox" aria-label="Department options">
                  {departmentOptions.map((dept) => {
                    const checked = formState.dept_ids.includes(dept)
                    return (
                      <li key={dept} role="option" aria-selected={checked}>
                        <label className="dept-dropdown-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDepartment(dept)}
                          />
                          {dept}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </FormField>

          {/* Row 2: Cost | Price Charged | In Stock | Tax Codes | Vendor */}
          <FormField label="Cost" required error={fieldErrors.cost} showError={showValidation}>
            <input
              className="ticket-input"
              aria-label="Cost"
              inputMode="numeric"
              value={formState.cost}
              onChange={(event) => updateCurrencyField('cost', event.target.value)}
            />
          </FormField>
          <FormField
            label="Price Charged"
            required
            error={fieldErrors.retail_price}
            showError={showValidation}
          >
            <div className="item-form__price-wrapper">
              <input
                className="ticket-input"
                aria-label="Price Charged"
                inputMode="numeric"
                value={formState.retail_price}
                onChange={(event) => updateCurrencyField('retail_price', event.target.value)}
              />
              {markupSuggestions.length > 0 && (
                <div className="item-form__markup-hints">
                  {markupSuggestions.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className="item-form__markup-chip"
                      onClick={() =>
                        updateCurrencyField('retail_price', String(Math.round(s.price * 100)))
                      }
                    >
                      {s.label}: ${s.price.toFixed(2)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FormField>
          <FormField
            label="In Stock"
            required
            error={fieldErrors.in_stock}
            showError={showValidation}
          >
            <ValidatedInput
              fieldType="integer"
              aria-label="In Stock"
              value={formState.in_stock}
              onChange={(value) => setFormState((current) => ({ ...current, in_stock: value }))}
            />
          </FormField>
          <FormField label="Tax Codes" error={fieldErrors.tax_rates} showError={showValidation}>
            <div className="tax-dropdown" aria-label="Tax Codes">
              <button
                type="button"
                className="ticket-input tax-dropdown-toggle"
                onClick={() => setTaxDropdownOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={taxDropdownOpen}
              >
                <span className="tax-dropdown-summary">{taxRateSummary}</span>
                <span className="tax-dropdown-caret" aria-hidden="true">
                  &#9662;
                </span>
              </button>
              {taxDropdownOpen && (
                <ul className="tax-dropdown-menu" role="listbox" aria-label="Tax code options">
                  {taxCodeOptions.map((taxCode) => {
                    const rateStr = String(taxCode.rate)
                    const checked = formState.tax_rates.includes(rateStr)
                    return (
                      <li key={taxCode.code} role="option" aria-selected={checked}>
                        <label className="tax-dropdown-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTaxRate(rateStr)}
                          />
                          {taxCode.code} ({(taxCode.rate * 100).toFixed(2)}%)
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </FormField>
          <FormField label="Vendor">
            <select
              className="ticket-input"
              aria-label="Vendor"
              value={formState.vendor_number}
              onChange={(event) =>
                setFormState((current) => ({ ...current, vendor_number: event.target.value }))
              }
            >
              <option value="">None</option>
              {vendorOptions.map((v) => (
                <option key={v.vendor_number} value={String(v.vendor_number)}>
                  {v.vendor_name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </section>

      {/* Tabs section */}
      <section className="item-form__tabs-section">
        <TabBar tabs={itemSubTabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="item-form__tab-content" role="tabpanel">
          {activeTab === 'case-settings' && (
            <div className="item-form__tab-panel">
              <div className="item-form__case-grid">
                <FormField label="Bottles Per Case">
                  <ValidatedInput
                    fieldType="integer"
                    aria-label="Bottles Per Case"
                    value={formState.bottles_per_case}
                    onChange={(value) =>
                      setFormState((current) => ({ ...current, bottles_per_case: value }))
                    }
                    placeholder="e.g. 12"
                  />
                </FormField>
                <FormField
                  label={
                    formState.case_discount_mode === 'percent'
                      ? 'Case Discount (%)'
                      : 'Case Discount Price ($)'
                  }
                >
                  <div className="item-form__case-discount-row">
                    <button
                      type="button"
                      className={`item-form__mode-toggle ${formState.case_discount_mode === 'percent' ? 'item-form__mode-toggle--active' : ''}`}
                      aria-label="Switch to percent mode"
                      aria-pressed={formState.case_discount_mode === 'percent'}
                      onClick={() =>
                        setFormState((current) => ({
                          ...current,
                          case_discount_mode: 'percent' as CaseDiscountMode,
                          case_discount_price: ''
                        }))
                      }
                    >
                      %
                    </button>
                    <button
                      type="button"
                      className={`item-form__mode-toggle ${formState.case_discount_mode === 'dollar' ? 'item-form__mode-toggle--active' : ''}`}
                      aria-label="Switch to dollar mode"
                      aria-pressed={formState.case_discount_mode === 'dollar'}
                      onClick={() =>
                        setFormState((current) => ({
                          ...current,
                          case_discount_mode: 'dollar' as CaseDiscountMode,
                          case_discount_price: ''
                        }))
                      }
                    >
                      $
                    </button>
                    {formState.case_discount_mode === 'percent' ? (
                      <input
                        className="ticket-input"
                        aria-label="Case Discount Percent"
                        inputMode="decimal"
                        value={formState.case_discount_price}
                        onChange={(event) => {
                          const raw = event.target.value.replace(/[^0-9.]/g, '')
                          setFormState((current) => ({ ...current, case_discount_price: raw }))
                        }}
                        placeholder="e.g. 10"
                      />
                    ) : (
                      <input
                        className="ticket-input"
                        aria-label="Case Discount Price"
                        inputMode="numeric"
                        value={formState.case_discount_price}
                        onChange={(event) =>
                          updateCurrencyField('case_discount_price', event.target.value)
                        }
                        placeholder="e.g. $199.99"
                      />
                    )}
                  </div>
                </FormField>
              </div>
              <p className="item-form__case-hint">
                Set the number of bottles in a case to enable case-level inventory and pricing.
                {formState.case_discount_mode === 'percent'
                  ? ' Enter the discount percentage off the full case price.'
                  : ' The case discount price is the total price when selling a full case.'}
              </p>
            </div>
          )}
          {activeTab === 'additional-skus' && (
            <div className="item-form__tab-panel">
              <div className="item-form__inline-row">
                <input
                  className="ticket-input"
                  aria-label="Additional SKU Input"
                  placeholder="Enter additional SKU..."
                  value={additionalSkuInput}
                  onChange={(event) => setAdditionalSkuInput(event.target.value)}
                />
                <AppButton size="sm" onClick={addAdditionalSku}>
                  Add Additional SKU
                </AppButton>
              </div>
              {formState.additional_skus.length > 0 && (
                <ul className="item-form__sku-list">
                  {formState.additional_skus.map((sku) => (
                    <li key={sku}>
                      <span>{sku}</span>
                      <AppButton
                        size="sm"
                        variant="neutral"
                        onClick={() => removeAdditionalSku(sku)}
                      >
                        Remove
                      </AppButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'special-pricing' && (
            <div className="item-form__tab-panel">
              <div className="item-form__special-pricing-header">
                <span className="form-field__label">
                  Set quantity-based pricing deals (e.g. 2 bottles for $19.99 for 20 days)
                </span>
                <AppButton size="sm" onClick={addSpecialPricingRow}>
                  Add Rule
                </AppButton>
              </div>
              {formState.special_pricing.length === 0 ? (
                <p className="item-form__empty-state">
                  No special pricing rules. Click &quot;Add Rule&quot; to create one.
                </p>
              ) : (
                <table
                  className="item-form__special-pricing-table"
                  aria-label="Special Pricing Rules"
                >
                  <thead>
                    <tr>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Duration (days)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formState.special_pricing.map((row, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            className="ticket-input"
                            aria-label={`Rule ${index + 1} Quantity`}
                            inputMode="numeric"
                            placeholder="e.g. 2"
                            value={row.quantity}
                            onChange={(e) =>
                              updateSpecialPricingRow(index, 'quantity', e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="ticket-input"
                            aria-label={`Rule ${index + 1} Price`}
                            inputMode="numeric"
                            placeholder="e.g. $19.99"
                            value={row.price}
                            onChange={(e) =>
                              updateSpecialPricingRow(index, 'price', e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="ticket-input"
                            aria-label={`Rule ${index + 1} Duration`}
                            inputMode="numeric"
                            placeholder="e.g. 20"
                            value={row.duration_days}
                            onChange={(e) =>
                              updateSpecialPricingRow(index, 'duration_days', e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <AppButton
                            size="sm"
                            variant="neutral"
                            onClick={() => removeSpecialPricingRow(index)}
                          >
                            Remove
                          </AppButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'sales-history' && (
            <div className="item-form__tab-panel">
              {!selectedItem || selectedItem.sales_history.length === 0 ? (
                <p className="item-form__empty-state">No sales history found</p>
              ) : (
                <table className="item-form__history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Txn #</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItem.sales_history.map((h) => (
                      <tr key={`${h.transaction_id}-${h.created_at}`}>
                        <td>{new Date(h.created_at).toLocaleDateString()}</td>
                        <td className="item-form__history-txn">
                          {h.transaction_number ?? `#${h.transaction_id}`}
                        </td>
                        <td>{h.quantity}</td>
                        <td>{formatCurrency(h.unit_price)}</td>
                        <td>{formatCurrency(h.total_price)}</td>
                        <td>
                          {h.payment_method ?? '—'}
                          {h.card_type && h.card_last_four && (
                            <span className="item-form__history-card">
                              {' '}
                              ({h.card_type} ****{h.card_last_four})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Status messages */}
      <div className="item-form__status-strip">
        {saveMessage && <p className="item-form__message success">{saveMessage}</p>}
        {errorMessage && <p className="item-form__message error">{errorMessage}</p>}
      </div>

      {/* Bottom search bar */}
      <div className="item-form__search-bar">
        <span className="form-field__label">Item Lookup</span>
        <input
          className="ticket-input"
          aria-label="Search Inventory"
          placeholder="Scan or enter SKU to look up item..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleSearch()
          }}
        />
        <AppButton size="md" onClick={() => void handleSearch()}>
          Search
        </AppButton>
      </div>
    </div>
  )
}
