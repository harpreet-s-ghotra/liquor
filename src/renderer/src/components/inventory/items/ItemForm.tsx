import { useCallback, useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { InventoryInput, InventorySelect } from '@renderer/components/common/InventoryInput'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import type {
  InventoryProduct,
  InventoryProductDetail,
  InventoryTaxCode,
  SaveInventoryItemInput,
  SpecialPricingRule,
  Vendor,
  Department
} from '@renderer/types/pos'
import { SKU_PATTERN, SKU_MAX_LENGTH, NAME_MAX_LENGTH } from '../../../../../shared/constants'
import {
  formatCurrency,
  normalizeCurrencyForInput,
  parseCurrencyDigitsToDollars
} from '@renderer/utils/currency'

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
  item_type: string
  dept_id: string
  vendor_number: string
  cost: string
  retail_price: string
  in_stock: string
  tax_rate: string
  special_pricing: SpecialPricingFormRow[]
  additional_skus: string[]
  bottles_per_case: string
  case_discount_price: string
  case_discount_mode: CaseDiscountMode
}

const emptyFormState: InventoryFormState = {
  sku: '',
  item_name: '',
  item_type: '',
  dept_id: '',
  vendor_number: '',
  cost: '',
  retail_price: '',
  in_stock: '',
  tax_rate: '',
  special_pricing: [],
  additional_skus: [],
  bottles_per_case: '12',
  case_discount_price: '',
  case_discount_mode: 'percent'
}

export type ItemFormHandle = {
  handleNewItem: () => void
  handleSave: () => void
  handleDiscard: () => void
  handleDelete: () => void
  selectItem: (item: InventoryProduct) => void
  startNewWithSku: (sku: string) => void
}

export type ItemFormButtonState = {
  canNew: boolean
  canSave: boolean
  canDelete: boolean
  selectedSku: string | null
}

type ItemFormProps = {
  onButtonStateChange?: (state: ItemFormButtonState) => void
  onSaveComplete?: () => void
}

export const ItemForm = forwardRef<ItemFormHandle, ItemFormProps>(function ItemForm(
  { onButtonStateChange, onSaveComplete },
  ref
) {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const [departmentOptions, setDepartmentOptions] = useState<Department[]>([])
  const [taxCodeOptions, setTaxCodeOptions] = useState<InventoryTaxCode[]>([])
  const [vendorOptions, setVendorOptions] = useState<Vendor[]>([])
  const [selectedItem, setSelectedItem] = useState<InventoryProductDetail | null>(null)
  const [formState, setFormState] = useState<InventoryFormState>(emptyFormState)
  const [additionalSkuInput, setAdditionalSkuInput] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  // Tracks whether the current retail_price was auto-calculated from cost + dept margin
  const [priceAutoCalc, setPriceAutoCalc] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('case-settings')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const hasBackendApi =
    typeof api?.searchInventoryProducts === 'function' &&
    typeof api?.getInventoryProductDetail === 'function' &&
    typeof api?.saveInventoryItem === 'function' &&
    typeof api?.getDepartments === 'function' &&
    typeof api?.getInventoryTaxCodes === 'function' &&
    typeof api?.getVendors === 'function'

  const normalizedTaxRateOptions = useMemo(
    () => new Set(taxCodeOptions.map((option) => Number(option.rate.toFixed(6)))),
    [taxCodeOptions]
  )

  const isAllowedTaxRate = useCallback(
    (rawValue: string): boolean => {
      const parsedRate = Number.parseFloat(rawValue)
      if (Number.isNaN(parsedRate)) return false
      return normalizedTaxRateOptions.has(Number(parsedRate.toFixed(6)))
    },
    [normalizedTaxRateOptions]
  )

  useEffect(() => {
    if (!hasBackendApi) return
    let active = true
    void Promise.all([api.getDepartments(), api.getInventoryTaxCodes(), api.getVendors()])
      .then(([departments, taxCodes, vendors]) => {
        if (!active) return
        setDepartmentOptions(departments)
        setTaxCodeOptions(taxCodes)
        setVendorOptions(vendors)
      })
      .catch(() => {
        if (!active) return
        setErrorMessage('Unable to load inventory reference data.')
      })
    return () => {
      active = false
    }
  }, [api, hasBackendApi])

  const applyDetailToForm = (detail: InventoryProductDetail): void => {
    const detailTaxRates =
      detail.tax_rates && detail.tax_rates.length > 0
        ? detail.tax_rates
        : [detail.tax_1, detail.tax_2].filter(
            (taxRate) =>
              taxRate !== null && taxRate !== undefined && Number.isFinite(taxRate) && taxRate >= 0
          )

    const optionRateStrings = new Set(taxCodeOptions.map((tc) => String(tc.rate)))
    const filteredTaxRates =
      taxCodeOptions.length > 0
        ? detailTaxRates.filter((taxRate) => optionRateStrings.has(String(taxRate)))
        : detailTaxRates

    setSelectedItem(detail)
    setFormState({
      item_number: detail.item_number,
      sku: detail.sku,
      item_name: detail.item_name,
      item_type: '',
      dept_id: detail.dept_id
        ? (detail.dept_id
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean)[0] ?? '')
        : '',
      cost: formatCurrency(detail.cost),
      retail_price: formatCurrency(detail.retail_price),
      vendor_number: detail.vendor_number != null ? String(detail.vendor_number) : '',
      in_stock: String(detail.in_stock),
      tax_rate: filteredTaxRates[0] != null ? String(filteredTaxRates[0]) : '',
      special_pricing: (detail.special_pricing ?? []).map((rule) => ({
        quantity: String(rule.quantity),
        price: formatCurrency(rule.price),
        duration_days: String(rule.duration_days)
      })),
      additional_skus: [...detail.additional_skus],
      bottles_per_case: String(detail.bottles_per_case ?? 12),
      case_discount_price:
        detail.case_discount_price != null ? formatCurrency(detail.case_discount_price) : '',
      case_discount_mode: (detail.case_discount_price != null
        ? 'dollar'
        : 'percent') as CaseDiscountMode
    })
  }

  const handleNewItem = (): void => {
    setSelectedItem(null)
    setFormState(emptyFormState)
    setShowValidation(false)
    setSaveMessage(null)
    setErrorMessage(null)
    setActiveTab('case-settings')
    setPriceAutoCalc(false)
  }

  const startNewWithSku = (sku: string): void => {
    handleNewItem()
    setFormState((prev) => ({ ...prev, sku: sku.replace(/[^A-Za-z0-9-]/g, '').toUpperCase() }))
  }

  const handleDiscard = (): void => {
    if (selectedItem) {
      applyDetailToForm(selectedItem)
    } else {
      setFormState(emptyFormState)
    }
    setShowValidation(false)
    setSaveMessage(null)
    setErrorMessage(null)
    setPriceAutoCalc(false)
  }

  const handleDelete = (): void => {
    if (!selectedItem) return
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirmed = async (): Promise<void> => {
    setShowDeleteConfirm(false)
    if (!selectedItem) return
    if (!hasBackendApi || typeof api?.deleteInventoryItem !== 'function') {
      setErrorMessage('Delete is not available in this environment.')
      return
    }
    try {
      await api.deleteInventoryItem(selectedItem.item_number)
      handleNewItem()
      setSaveMessage('Item deleted successfully')
      onSaveComplete?.()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete item')
    }
  }

  const selectItem = async (item: InventoryProduct): Promise<void> => {
    setSaveMessage(null)
    setErrorMessage(null)
    if (!hasBackendApi) return
    try {
      const detail = await api!.getInventoryProductDetail(item.item_number)
      if (detail) {
        applyDetailToForm(detail)
        setShowValidation(false)
      }
    } catch {
      setErrorMessage('Unable to load item details.')
    }
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
      formState.dept_id &&
      departmentOptions.length > 0 &&
      !departmentOptions.some((d) => d.name === formState.dept_id)
    ) {
      errors.dept_id = 'Department must be selected from available values'
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

    if (formState.tax_rate && taxCodeOptions.length > 0 && !isAllowedTaxRate(formState.tax_rate)) {
      errors.tax_rate = 'Tax code must be selected from available values'
    }

    return errors
  }, [departmentOptions, formState, isAllowedTaxRate, taxCodeOptions.length])

  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  const isFormEmpty = !formState.sku.trim() && !formState.item_name.trim()

  const parsePayload = (): SaveInventoryItemInput | null => {
    const cost = parseCurrencyDigitsToDollars(formState.cost)
    const retailPrice = parseCurrencyDigitsToDollars(formState.retail_price)
    const inStock = Number.parseInt(formState.in_stock, 10)

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
      dept_id: formState.dept_id,
      vendor_number: formState.vendor_number ? Number.parseInt(formState.vendor_number, 10) : null,
      cost,
      retail_price: retailPrice,
      in_stock: inStock,
      tax_rates: formState.tax_rate ? [parseFloat(formState.tax_rate)] : [],
      special_pricing: specialPricing,
      additional_skus: formState.additional_skus,
      bottles_per_case: formState.bottles_per_case
        ? Number.parseInt(formState.bottles_per_case, 10)
        : 12,
      case_discount_price: (() => {
        if (!formState.case_discount_price) return null
        if (formState.case_discount_mode === 'percent') {
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
      setShowValidation(false)
      setErrorMessage(null)
      setSaveMessage('Item saved')
      onSaveComplete?.()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save item')
    }
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

  /** Handle cost change — auto-calculate retail price if a dept with margin is selected.
   *  Formula: price = cost / (1 - margin%), e.g. $10 cost at 30% margin → $14.29 price. */
  const handleCostChange = (value: string): void => {
    const normalized = normalizeCurrencyForInput(value)
    setFormState((current) => {
      const updates: Partial<InventoryFormState> = { cost: normalized }
      const dept = departmentOptions.find((d) => d.name === current.dept_id)
      if (dept && dept.default_profit_margin > 0) {
        const costVal = parseCurrencyDigitsToDollars(normalized)
        if (!Number.isNaN(costVal) && costVal > 0) {
          const margin = dept.default_profit_margin / 100
          updates.retail_price = formatCurrency(costVal / (1 - margin))
          setPriceAutoCalc(true)
          return { ...current, ...updates }
        }
      }
      setPriceAutoCalc(false)
      return { ...current, ...updates }
    })
  }

  /** Handle dept selection — auto-fill default tax code and recalculate price from margin.
   *  Formula: price = cost / (1 - margin%), applied when cost is already entered. */
  const handleDeptChange = (deptName: string): void => {
    const dept = departmentOptions.find((d) => d.name === deptName)
    setFormState((current) => {
      const updates: Partial<InventoryFormState> = { dept_id: deptName }
      if (dept) {
        updates.tax_rate = dept.default_tax_rate > 0 ? String(dept.default_tax_rate / 100) : ''
        if (dept.default_profit_margin > 0) {
          const costVal = parseCurrencyDigitsToDollars(current.cost)
          if (!Number.isNaN(costVal) && costVal > 0) {
            const margin = dept.default_profit_margin / 100
            updates.retail_price = formatCurrency(costVal / (1 - margin))
            setPriceAutoCalc(true)
            return { ...current, ...updates }
          }
        }
      }
      setPriceAutoCalc(false)
      return { ...current, ...updates }
    })
  }

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

  const finalPriceWithTax = useMemo(() => {
    const price = parseCurrencyDigitsToDollars(formState.retail_price)
    if (Number.isNaN(price) || price <= 0) return null
    const taxRate = Number.parseFloat(formState.tax_rate)
    const rate = Number.isNaN(taxRate) ? 0 : taxRate
    return price * (1 + rate)
  }, [formState.retail_price, formState.tax_rate])

  const profitMargin = useMemo(() => {
    const price = parseCurrencyDigitsToDollars(formState.retail_price)
    const cost = parseCurrencyDigitsToDollars(formState.cost)
    if (Number.isNaN(price) || price <= 0 || Number.isNaN(cost)) return null
    return ((price - cost) / price) * 100
  }, [formState.retail_price, formState.cost])

  useImperativeHandle(ref, () => ({
    handleNewItem,
    handleSave: () => void handleSave(),
    handleDiscard,
    handleDelete: () => void handleDelete(),
    selectItem: (item: InventoryProduct) => void selectItem(item),
    startNewWithSku
  }))

  useEffect(() => {
    onButtonStateChange?.({
      canNew: !!selectedItem,
      canSave: !(showValidation && hasFieldErrors),
      canDelete: !!selectedItem,
      selectedSku: selectedItem?.sku ?? null
    })
  }, [selectedItem, showValidation, hasFieldErrors, onButtonStateChange])

  /* ── Shared style helpers ── */
  const labelCls =
    'block text-[10px] font-black uppercase tracking-[1px] text-[var(--text-primary)] mb-1'

  const errCls = 'text-[10px] text-[var(--error)] mt-0.5'

  const requiredStar = <span className="text-[var(--error)]">*</span>

  /* ── Tab trigger shared class ── */
  const tabTriggerCls =
    'rounded-none border-b-[3px] border-transparent min-h-[44px] px-5 py-3 text-[13px] font-bold uppercase tracking-[0.5px] text-[var(--text-muted)] bg-transparent data-[state=active]:border-[var(--btn-success-bg)] data-[state=active]:text-[var(--text-primary)] data-[state=active]:bg-transparent data-[state=active]:shadow-none disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg-panel)]">
      {/* ── General Information ── */}
      <section aria-label="General Information" className="shrink-0">
        {/* Section header band */}
        <div className="px-4 py-1.5 bg-[var(--bg-surface-soft)] border-b border-[var(--border-default)]">
          <span className="text-[10px] font-black uppercase tracking-[1.5px] text-[var(--text-label)]">
            General Information
          </span>
        </div>

        <div className="px-4 py-3 grid grid-cols-4 gap-x-4 gap-y-3">
          {/* ── Row 1: Department | Item Type | SKU | Cost ── */}

          {/* Department */}
          <div>
            <label className={labelCls}>Department</label>
            <InventorySelect
              aria-label="Department"
              value={formState.dept_id}
              hasError={showValidation && !!fieldErrors.dept_id}
              onChange={(e) => handleDeptChange(e.target.value)}
            >
              <option value="">None</option>
              {departmentOptions.map((dept) => (
                <option key={dept.id} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </InventorySelect>
            {showValidation && fieldErrors.dept_id && (
              <p className={errCls}>{fieldErrors.dept_id}</p>
            )}
          </div>

          {/* Item Type */}
          <div>
            <label className={labelCls}>Item Type</label>
            <InventoryInput
              type="text"
              aria-label="Item Type"
              value={formState.item_type}
              onChange={(e) => setFormState((c) => ({ ...c, item_type: e.target.value }))}
              placeholder="e.g. Wine"
            />
          </div>

          {/* SKU */}
          <div>
            <label className={labelCls}>SKU {requiredStar}</label>
            <InventoryInput
              type="text"
              aria-label="SKU"
              hasError={showValidation && !!fieldErrors.sku}
              className="font-mono"
              value={formState.sku}
              onChange={(e) =>
                setFormState((c) => ({
                  ...c,
                  sku: e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
                }))
              }
              placeholder="e.g. WINE-001"
              maxLength={SKU_MAX_LENGTH}
            />
            {showValidation && fieldErrors.sku && <p className={errCls}>{fieldErrors.sku}</p>}
          </div>

          {/* Cost */}
          <div>
            <label className={labelCls}>Cost {requiredStar}</label>
            <InventoryInput
              type="text"
              aria-label="Cost"
              inputMode="numeric"
              hasError={showValidation && !!fieldErrors.cost}
              className="font-bold text-[var(--semantic-danger-text)]"
              value={formState.cost}
              onChange={(e) => handleCostChange(e.target.value)}
              placeholder="$0.00"
            />
            {showValidation && fieldErrors.cost && <p className={errCls}>{fieldErrors.cost}</p>}
          </div>

          {/* ── Row 2: Description (×2) | Price You Charge | # In Stock ── */}

          {/* Description */}
          <div className="col-span-2">
            <label className={labelCls}>Description {requiredStar}</label>
            <InventoryInput
              type="text"
              aria-label="Name"
              hasError={showValidation && !!fieldErrors.item_name}
              value={formState.item_name}
              onChange={(e) => setFormState((c) => ({ ...c, item_name: e.target.value }))}
              maxLength={NAME_MAX_LENGTH}
              placeholder="Item description"
            />
            {showValidation && fieldErrors.item_name && (
              <p className={errCls}>{fieldErrors.item_name}</p>
            )}
          </div>

          {/* Price You Charge */}
          <div>
            <label className={labelCls}>
              Price You Charge {requiredStar}
              {priceAutoCalc && (
                <span className="ml-1.5 text-[9px] font-bold normal-case tracking-normal text-[var(--accent-mint)] opacity-80">
                  auto
                </span>
              )}
            </label>
            <InventoryInput
              type="text"
              aria-label="Price Charged"
              inputMode="numeric"
              hasError={showValidation && !!fieldErrors.retail_price}
              className="bg-[var(--accent-mint-soft)] font-bold text-[var(--accent-mint)]"
              value={formState.retail_price}
              onChange={(e) => {
                updateCurrencyField('retail_price', e.target.value)
                setPriceAutoCalc(false)
              }}
              placeholder="$0.00"
            />
            {showValidation && fieldErrors.retail_price && (
              <p className={errCls}>{fieldErrors.retail_price}</p>
            )}
          </div>

          {/* # In Stock */}
          <div>
            <label className={labelCls}># In Stock {requiredStar}</label>
            <InventoryInput
              type="text"
              aria-label="In Stock"
              inputMode="numeric"
              hasError={showValidation && !!fieldErrors.in_stock}
              className="font-bold text-[var(--accent-blue)]"
              value={formState.in_stock}
              onChange={(e) => setFormState((c) => ({ ...c, in_stock: e.target.value }))}
              placeholder="0"
            />
            {showValidation && fieldErrors.in_stock && (
              <p className={errCls}>{fieldErrors.in_stock}</p>
            )}
          </div>

          {/* ── Row 3: Tax Profile | Final w/ Tax | Profit Margin (×2) ── */}

          {/* Tax Profile */}
          <div>
            <label className={labelCls}>Tax Profile</label>
            <InventorySelect
              aria-label="Tax Codes"
              value={formState.tax_rate}
              hasError={showValidation && !!fieldErrors.tax_rate}
              onChange={(e) => setFormState((c) => ({ ...c, tax_rate: e.target.value }))}
            >
              <option value="">No Tax</option>
              {taxCodeOptions.map((taxCode) => (
                <option key={taxCode.code} value={String(taxCode.rate)}>
                  {taxCode.code} ({parseFloat((taxCode.rate * 100).toFixed(4))}%)
                </option>
              ))}
            </InventorySelect>
            {showValidation && fieldErrors.tax_rate && (
              <p className={errCls}>{fieldErrors.tax_rate}</p>
            )}
          </div>

          {/* Final w/ Tax */}
          <div>
            <label className={labelCls}>Final w/ Tax</label>
            <InventoryInput
              type="text"
              aria-label="Final Price with Tax"
              readOnly
              className="bg-[var(--bg-surface-soft)] font-bold text-[var(--text-muted)] cursor-default"
              value={finalPriceWithTax != null ? formatCurrency(finalPriceWithTax) : '—'}
            />
          </div>

          {/* Profit Margin */}
          <div className="col-span-2">
            <label className={labelCls}>Profit Margin</label>
            <div
              aria-label="Profit Margin"
              className={`h-9 bg-[var(--bg-input)] rounded-[var(--radius)] px-2.5 flex items-center text-[14px] font-black border border-[var(--border-default)] ${
                profitMargin == null
                  ? 'text-[var(--text-muted)]'
                  : profitMargin > 20
                    ? 'text-[var(--semantic-success-text)]'
                    : profitMargin >= 10
                      ? 'text-[var(--semantic-warning-text)]'
                      : 'text-[var(--semantic-danger-text)]'
              }`}
            >
              {profitMargin != null ? `${profitMargin.toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>
      </section>

      {/* ── Inner Tabs ── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 min-h-0 flex flex-col overflow-hidden border-t border-[var(--border-default)]"
      >
        <TabsList className="gap-0 bg-[var(--bg-surface)] border-b border-[var(--border-default)] rounded-none p-0 h-auto justify-start w-full shrink-0">
          <TabsTrigger value="case-settings" disabled={isFormEmpty} className={tabTriggerCls}>
            Case &amp; Quantity
          </TabsTrigger>
          <TabsTrigger value="additional-skus" disabled={isFormEmpty} className={tabTriggerCls}>
            Additional SKUs
          </TabsTrigger>
          <TabsTrigger value="special-pricing" disabled={isFormEmpty} className={tabTriggerCls}>
            Special Pricing
          </TabsTrigger>
          <TabsTrigger value="sales-history" disabled={isFormEmpty} className={tabTriggerCls}>
            Sales History
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-auto">
          {/* Case & Quantity */}
          <TabsContent value="case-settings" className="p-3 grid gap-2 content-start">
            <div className="grid grid-cols-3 gap-3">
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
              <FormField label="Case Discount">
                <div className="flex items-stretch">
                  {formState.case_discount_mode === 'percent' ? (
                    <Input
                      className="flex-1 min-w-0 rounded-r-none! border-r-0!"
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
                    <Input
                      className="flex-1 min-w-0 rounded-r-none! border-r-0!"
                      aria-label="Case Discount Price"
                      inputMode="numeric"
                      value={formState.case_discount_price}
                      onChange={(event) =>
                        updateCurrencyField('case_discount_price', event.target.value)
                      }
                      placeholder="e.g. $199.99"
                    />
                  )}
                  <ToggleGroup
                    type="single"
                    value={formState.case_discount_mode}
                    onValueChange={(val) => {
                      if (val) {
                        setFormState((current) => ({
                          ...current,
                          case_discount_mode: val as CaseDiscountMode,
                          case_discount_price: ''
                        }))
                      }
                    }}
                  >
                    <ToggleGroupItem value="percent" aria-label="Switch to percent mode">
                      %
                    </ToggleGroupItem>
                    <ToggleGroupItem value="dollar" aria-label="Switch to dollar mode">
                      $
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </FormField>
              <FormField label="Vendor">
                <select
                  className="flex w-full rounded-[var(--radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)] focus:ring-1 focus:ring-[var(--accent-blue)]"
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
            <p className="m-0 text-[0.82rem] text-[var(--text-muted)] italic">
              Set the number of bottles in a case to enable case-level inventory and pricing.
              {formState.case_discount_mode === 'percent'
                ? ' Enter the discount percentage off the full case price.'
                : ' The case discount price is the total price when selling a full case.'}
            </p>
          </TabsContent>

          {/* Additional SKUs */}
          <TabsContent value="additional-skus" className="p-3 grid gap-2 content-start">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Input
                aria-label="Additional SKU Input"
                placeholder="Enter additional SKU..."
                value={additionalSkuInput}
                onChange={(event) => setAdditionalSkuInput(event.target.value)}
              />
              <Button size="sm" onClick={addAdditionalSku}>
                Add Additional SKU
              </Button>
            </div>
            {formState.additional_skus.length > 0 && (
              <ul className="m-0 p-0 list-none grid gap-1">
                {formState.additional_skus.map((sku) => (
                  <li
                    key={sku}
                    className="flex justify-between items-center gap-1.5 py-1 border-b border-[var(--border-soft)] text-[var(--text-primary)] font-semibold text-[0.92rem]"
                  >
                    <span>{sku}</span>
                    <Button size="sm" variant="neutral" onClick={() => removeAdditionalSku(sku)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* Special Pricing */}
          <TabsContent value="special-pricing" className="p-3 grid gap-2 content-start">
            <div className="flex items-center justify-between gap-3">
              <Label>
                Set quantity-based pricing deals (e.g. 2 bottles for $19.99 for 20 days)
              </Label>
              <Button size="sm" onClick={addSpecialPricingRow}>
                Add Rule
              </Button>
            </div>
            {formState.special_pricing.length === 0 ? (
              <p className="m-0 text-[var(--text-muted)] italic">
                No special pricing rules. Click &quot;Add Rule&quot; to create one.
              </p>
            ) : (
              <table className="w-full border-collapse" aria-label="Special Pricing Rules">
                <thead>
                  <tr>
                    <th className="text-left text-[0.85rem] font-bold text-[var(--text-primary)] px-2 py-1.5 border-b border-[var(--border-soft)]">
                      Quantity
                    </th>
                    <th className="text-left text-[0.85rem] font-bold text-[var(--text-primary)] px-2 py-1.5 border-b border-[var(--border-soft)]">
                      Price
                    </th>
                    <th className="text-left text-[0.85rem] font-bold text-[var(--text-primary)] px-2 py-1.5 border-b border-[var(--border-soft)]">
                      Duration (days)
                    </th>
                    <th className="px-2 py-1.5 border-b border-[var(--border-soft)]"></th>
                  </tr>
                </thead>
                <tbody>
                  {formState.special_pricing.map((row, index) => (
                    <tr key={index}>
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label={`Rule ${index + 1} Quantity`}
                          inputMode="numeric"
                          placeholder="e.g. 2"
                          value={row.quantity}
                          onChange={(e) =>
                            updateSpecialPricingRow(index, 'quantity', e.target.value)
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label={`Rule ${index + 1} Price`}
                          inputMode="numeric"
                          placeholder="e.g. $19.99 total"
                          value={row.price}
                          onChange={(e) => updateSpecialPricingRow(index, 'price', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label={`Rule ${index + 1} Duration`}
                          inputMode="numeric"
                          placeholder="e.g. 20"
                          value={row.duration_days}
                          onChange={(e) =>
                            updateSpecialPricingRow(index, 'duration_days', e.target.value)
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Button
                          size="sm"
                          variant="neutral"
                          onClick={() => removeSpecialPricingRow(index)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>

          {/* Sales History */}
          <TabsContent value="sales-history" className="p-3 grid gap-2 content-start">
            {!selectedItem || selectedItem.sales_history.length === 0 ? (
              <p className="m-0 text-[var(--text-muted)] italic">No sales history found</p>
            ) : (
              <table className="w-full border-collapse text-[0.85rem] text-[var(--text-primary)]">
                <thead>
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-[var(--text-muted)] text-[0.8rem] uppercase tracking-wide border-b border-[var(--border-default)]">
                      Date
                    </th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[var(--text-muted)] text-[0.8rem] uppercase tracking-wide border-b border-[var(--border-default)]">
                      Txn #
                    </th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[var(--text-muted)] text-[0.8rem] uppercase tracking-wide border-b border-[var(--border-default)]">
                      Qty
                    </th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[var(--text-muted)] text-[0.8rem] uppercase tracking-wide border-b border-[var(--border-default)]">
                      Price
                    </th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[var(--text-muted)] text-[0.8rem] uppercase tracking-wide border-b border-[var(--border-default)]">
                      Total
                    </th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[var(--text-muted)] text-[0.8rem] uppercase tracking-wide border-b border-[var(--border-default)]">
                      Payment
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItem.sales_history.map((h) => (
                    <tr key={`${h.transaction_id}-${h.created_at}`}>
                      <td className="px-2 py-1.5 border-b border-[var(--border-default)]">
                        {new Date(h.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-1.5 border-b border-[var(--border-default)] font-mono text-[0.8rem]">
                        {h.transaction_number ?? `#${h.transaction_id}`}
                      </td>
                      <td className="px-2 py-1.5 border-b border-[var(--border-default)]">
                        {h.quantity}
                      </td>
                      <td className="px-2 py-1.5 border-b border-[var(--border-default)]">
                        {formatCurrency(h.unit_price)}
                      </td>
                      <td className="px-2 py-1.5 border-b border-[var(--border-default)]">
                        {formatCurrency(h.total_price)}
                      </td>
                      <td className="px-2 py-1.5 border-b border-[var(--border-default)]">
                        {h.payment_method ?? '—'}
                        {h.card_type && h.card_last_four && (
                          <span className="text-[var(--text-muted)] text-[0.8rem]">
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
          </TabsContent>
        </div>
      </Tabs>

      {/* Status messages */}
      {(saveMessage || errorMessage) && (
        <div className="shrink-0 px-4 py-2 bg-[var(--bg-panel)] border-t border-[var(--border-default)] grid gap-0.5">
          {saveMessage && (
            <p className="m-0 text-[0.9rem] font-semibold text-[var(--semantic-success-text)]">
              {saveMessage}
            </p>
          )}
          {errorMessage && (
            <p className="m-0 text-[0.9rem] font-semibold text-[var(--semantic-danger-text)]">
              {errorMessage}
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Item"
        message={`Are you sure you want to delete "${selectedItem?.item_name ?? selectedItem?.sku}"? This action cannot be undone.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteConfirmed()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
})
