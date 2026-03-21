import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef
} from 'react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { useDebounce } from '@renderer/hooks/useDebounce'
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

export type ItemFormHandle = {
  handleNewItem: () => void
  handleSave: () => void
}

export type ItemFormButtonState = {
  canNew: boolean
  canSave: boolean
}

type ItemFormProps = {
  onButtonStateChange?: (state: ItemFormButtonState) => void
}

export const ItemForm = forwardRef<ItemFormHandle, ItemFormProps>(function ItemForm(
  { onButtonStateChange },
  ref
) {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<InventoryProduct[]>([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(searchTerm, 300)
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
      setSearchResults(results)
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
      .then(([, departments, taxCodes, vendors]) => {
        if (!active) return
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

  // Debounced search: fire search when debouncedSearch changes
  useEffect(() => {
    if (!hasBackendApi || !debouncedSearch.trim()) return
    let active = true
    void api!.searchInventoryProducts(debouncedSearch).then((results) => {
      if (!active) return
      setSearchResults(results)
      setShowSearchDropdown(results.length > 0)
    })
    return () => {
      active = false
    }
  }, [debouncedSearch, api, hasBackendApi])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const applyDetailToForm = (detail: InventoryProductDetail): void => {
    const detailTaxRates =
      detail.tax_rates && detail.tax_rates.length > 0
        ? detail.tax_rates
        : [detail.tax_1, detail.tax_2].filter(
            (taxRate) =>
              taxRate !== null && taxRate !== undefined && Number.isFinite(taxRate) && taxRate >= 0
          )

    // Filter out legacy rates (e.g. default 0) that don't match any current tax code option
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
      tax_rates: Array.from(new Set(filteredTaxRates.map((taxRate) => String(taxRate)))),
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
  const isFormEmpty = !formState.sku.trim() && !formState.item_name.trim()

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
      setSearchResults(results)
      if (results.length > 0) {
        setShowSearchDropdown(true)
      } else {
        setShowSearchDropdown(false)
        setSelectedItem(null)
        setFormState(defaultFormState)
        setErrorMessage('No items found. You can enter a new item above.')
      }
    } catch {
      setErrorMessage('Unable to search inventory.')
    }
  }

  const selectSearchResult = async (item: InventoryProduct): Promise<void> => {
    setShowSearchDropdown(false)
    setSaveMessage(null)
    setErrorMessage(null)
    try {
      const detail = await api!.getInventoryProductDetail(item.item_number)
      if (detail) {
        applyDetailToForm(detail)
        setShowValidation(false)
        setSearchTerm(item.sku || item.item_name)
      }
    } catch {
      setErrorMessage('Unable to load item details.')
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
      .map((tc) => `${tc.code} (${parseFloat((tc.rate * 100).toFixed(4))}%)`)
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

  useImperativeHandle(ref, () => ({
    handleNewItem,
    handleSave: () => void handleSave()
  }))

  useEffect(() => {
    onButtonStateChange?.({
      canNew: !!selectedItem,
      canSave: !(showValidation && hasFieldErrors)
    })
  }, [selectedItem, showValidation, hasFieldErrors, onButtonStateChange])

  return (
    <div className="h-full grid grid-rows-[auto_1fr_auto_auto] gap-3 overflow-hidden">
      {/* Required fields card */}
      <section
        className="border border-(--border-default) rounded-(--radius) bg-(--bg-surface) p-3 grid gap-2.5"
        aria-label="Required Information"
      >
        <div className="grid grid-cols-5 gap-2.5">
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
            className="col-span-3"
          >
            <ValidatedInput
              fieldType="name"
              aria-label="Name"
              value={formState.item_name}
              onChange={(value) => setFormState((current) => ({ ...current, item_name: value }))}
            />
          </FormField>
          <FormField label="Department" error={fieldErrors.dept_id} showError={showValidation}>
            <div className="dept-dropdown">
              <Popover open={deptDropdownOpen} onOpenChange={setDeptDropdownOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 w-full rounded-[var(--radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-2 text-[1.125rem] text-[var(--text-primary)] cursor-pointer text-left focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/50 outline-none"
                    aria-label="Department"
                    aria-haspopup="listbox"
                    aria-expanded={deptDropdownOpen}
                  >
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[0.92rem]">
                      {deptSummary}
                    </span>
                    <span className="text-[0.75rem] text-[var(--text-muted)]" aria-hidden="true">
                      &#9662;
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent>
                  <ul role="listbox" aria-label="Department options" className="p-0 m-0 list-none">
                    {departmentOptions.map((dept) => {
                      const checked = formState.dept_ids.includes(dept)
                      return (
                        <li key={dept} role="option" aria-selected={checked}>
                          <label className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-[0.92rem] text-[var(--text-primary)] font-semibold rounded-[var(--radius)] mx-1">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleDepartment(dept)}
                            />
                            {dept}
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </PopoverContent>
              </Popover>
            </div>
          </FormField>

          {/* Row 2: Cost | Price Charged | In Stock | Tax Codes | Vendor */}
          <FormField label="Cost" required error={fieldErrors.cost} showError={showValidation}>
            <Input
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
            <div className="relative">
              <Input
                aria-label="Price Charged"
                inputMode="numeric"
                value={formState.retail_price}
                onChange={(event) => updateCurrencyField('retail_price', event.target.value)}
              />
              {markupSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 flex flex-wrap gap-1.5 mt-0.5 z-5">
                  {markupSuggestions.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className="border border-[var(--border-soft)] bg-[var(--bg-surface-soft)] text-[var(--text-primary)] text-[0.78rem] font-semibold px-2 py-0.5 rounded-full cursor-pointer whitespace-nowrap"
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
            <div className="tax-dropdown">
              <Popover open={taxDropdownOpen} onOpenChange={setTaxDropdownOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 w-full rounded-[var(--radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-2 text-[1.125rem] text-[var(--text-primary)] cursor-pointer text-left focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/50 outline-none"
                    aria-label="Tax Codes"
                    aria-haspopup="listbox"
                    aria-expanded={taxDropdownOpen}
                  >
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[0.92rem]">
                      {taxRateSummary}
                    </span>
                    <span className="text-[0.75rem] text-[var(--text-muted)]" aria-hidden="true">
                      &#9662;
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent>
                  <ul role="listbox" aria-label="Tax code options" className="p-0 m-0 list-none">
                    {taxCodeOptions.map((taxCode) => {
                      const rateStr = String(taxCode.rate)
                      const checked = formState.tax_rates.includes(rateStr)
                      return (
                        <li key={taxCode.code} role="option" aria-selected={checked}>
                          <label className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-[0.92rem] text-[var(--text-primary)] font-semibold rounded-[var(--radius)] mx-1">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleTaxRate(rateStr)}
                            />
                            {taxCode.code} ({parseFloat((taxCode.rate * 100).toFixed(4))}%)
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </PopoverContent>
              </Popover>
            </div>
          </FormField>
          <FormField label="Vendor">
            <select
              className="flex w-full rounded-[var(--radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-2 text-[1.125rem] text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/50"
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
      <Tabs
        defaultValue="case-settings"
        value={activeTab}
        onValueChange={setActiveTab}
        className="min-h-0 grid grid-rows-[auto_1fr] border border-[var(--border-default)] rounded-[var(--radius)] bg-[var(--bg-surface)] overflow-hidden"
      >
        <TabsList>
          <TabsTrigger value="case-settings" disabled={isFormEmpty}>
            Case &amp; Quantity
          </TabsTrigger>
          <TabsTrigger value="additional-skus" disabled={isFormEmpty}>
            Additional SKUs
          </TabsTrigger>
          <TabsTrigger value="special-pricing" disabled={isFormEmpty}>
            Special Pricing
          </TabsTrigger>
          <TabsTrigger value="sales-history" disabled={isFormEmpty}>
            Sales History
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 overflow-auto">
          <TabsContent value="case-settings" className="p-3 grid gap-2 content-start">
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <p className="m-0 text-[0.82rem] text-[var(--text-muted)] italic">
              Set the number of bottles in a case to enable case-level inventory and pricing.
              {formState.case_discount_mode === 'percent'
                ? ' Enter the discount percentage off the full case price.'
                : ' The case discount price is the total price when selling a full case.'}
            </p>
          </TabsContent>

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

          <TabsContent value="sales-history" className="p-3 grid gap-2 content-start">
            {!selectedItem || selectedItem.sales_history.length === 0 ? (
              <p className="m-0 text-[var(--text-muted)] italic">No sales history found</p>
            ) : (
              <table className="w-full border-collapse text-[0.85rem]">
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
      <div className="min-h-[1.5rem] grid gap-1 content-start">
        {saveMessage && (
          <p className="m-0 text-[0.95rem] font-semibold text-[var(--semantic-success-text)]">
            {saveMessage}
          </p>
        )}
        {errorMessage && (
          <p className="m-0 text-[0.95rem] font-semibold text-[var(--semantic-danger-text)]">
            {errorMessage}
          </p>
        )}
      </div>

      {/* Bottom search bar */}
      <div ref={searchWrapperRef} className="relative">
        <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center border border-[var(--border-default)] rounded-[var(--radius)] bg-[var(--bg-surface)] px-3 py-2">
          <Label className="whitespace-nowrap">Item Lookup</Label>
          <Input
            aria-label="Search Inventory"
            placeholder="Scan or enter SKU / name to look up item..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onFocus={() => {
              if (searchResults.length > 0 && searchTerm.trim()) setShowSearchDropdown(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleSearch()
              if (event.key === 'Escape') setShowSearchDropdown(false)
            }}
          />
          <Button size="md" onClick={() => void handleSearch()}>
            Search
          </Button>
        </div>
        {showSearchDropdown && searchResults.length > 0 && searchTerm.trim() && (
          <ul
            role="listbox"
            className="absolute bottom-full left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-[var(--radius)] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg mb-1"
          >
            {searchResults.map((item) => (
              <li
                key={item.item_number}
                role="option"
                aria-selected={false}
                className="px-3 py-1.5 cursor-pointer text-sm hover:bg-[var(--bg-hover)] flex justify-between items-center"
                onMouseDown={() => void selectSearchResult(item)}
              >
                <span className="truncate font-medium">{item.item_name}</span>
                <span className="ml-2 text-[var(--text-muted)] text-xs shrink-0">{item.sku}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
})
