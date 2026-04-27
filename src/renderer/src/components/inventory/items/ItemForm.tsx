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
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { FormField } from '@renderer/components/common/FormField'
import { InventoryInput, InventorySelect } from '@renderer/components/common/InventoryInput'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import { ErrorModal } from '@renderer/components/common/ErrorModal'
import { SuccessModal } from '@renderer/components/common/SuccessModal'
import type {
  InventoryProduct,
  InventoryProductDetail,
  InventoryTaxCode,
  NyslaDiscount,
  SaveInventoryItemInput,
  SpecialPricingRule,
  Distributor,
  ItemType
} from '@renderer/types/pos'
import { SKU_PATTERN, SKU_MAX_LENGTH, NAME_MAX_LENGTH } from '../../../../../shared/constants'
import {
  formatCurrency,
  formatCostInput,
  normalizeCurrencyForInput,
  normalizeDecimalInput,
  parseCurrencyDigitsToDollars,
  parseDecimalInput
} from '@renderer/utils/currency'
import { useDebounce } from '@renderer/hooks/useDebounce'
import { useSearchDropdown } from '@renderer/hooks/useSearchDropdown'
import { cn } from '@renderer/lib/utils'
import { CANONICAL_SIZE_SUGGESTIONS, normalizeSize } from '../../../../../shared/utils/size'
import './item-form.css'

const TOP_HEIGHT_STORAGE_KEY = 'inventory-form-top-height'
const DEFAULT_TOP_HEIGHT = 260
const TOP_MIN_HEIGHT = 80
const BOTTOM_MIN_HEIGHT = 240
const RESIZE_HANDLE_PX = 6
const RESIZE_KEYBOARD_STEP = 20

type SpecialPricingFormRow = {
  quantity: string
  price: string
  /** YYYY-MM-DD or ''. Blank = never expires. */
  expires_at: string
}

type CaseDiscountMode = 'percent' | 'dollar'

type InventoryFormState = {
  item_number?: number
  sku: string
  item_name: string
  item_type: string
  distributor_number: string
  cost: string
  retail_price: string
  in_stock: string
  tax_rate: string
  special_pricing: SpecialPricingFormRow[]
  additional_skus: string[]
  bottles_per_case: string
  case_discount_price: string
  case_discount_mode: CaseDiscountMode
  size: string
  case_cost: string
  nysla_discounts: string
  brand_name: string
  proof: string
  alcohol_pct: string
  vintage: string
  ttb_id: string
  display_name: string
  is_favorite: number
  is_discontinued: boolean
}

const emptyFormState: InventoryFormState = {
  sku: '',
  item_name: '',
  item_type: '',
  distributor_number: '',
  cost: '',
  retail_price: '',
  in_stock: '',
  tax_rate: '',
  special_pricing: [],
  additional_skus: [],
  bottles_per_case: '12',
  case_discount_price: '',
  case_discount_mode: 'percent',
  size: '',
  case_cost: '',
  nysla_discounts: '',
  brand_name: '',
  proof: '',
  alcohol_pct: '',
  vintage: '',
  ttb_id: '',
  display_name: '',
  is_favorite: 0,
  is_discontinued: false
}

export type ItemFormHandle = {
  handleNewItem: () => void
  duplicateCurrentAsNew: () => void
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
  onRecallTransaction?: (txnNumber: string) => void
}

export const ItemForm = forwardRef<ItemFormHandle, ItemFormProps>(function ItemForm(
  { onButtonStateChange, onSaveComplete, onRecallTransaction },
  ref
) {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const [itemTypeOptions, setItemTypeOptions] = useState<ItemType[]>([])
  const [taxCodeOptions, setTaxCodeOptions] = useState<InventoryTaxCode[]>([])
  const [distributorOptions, setDistributorOptions] = useState<Distributor[]>([])
  const [sizesInUse, setSizesInUse] = useState<string[]>([])
  const [selectedItem, setSelectedItem] = useState<InventoryProductDetail | null>(null)
  const [formState, setFormState] = useState<InventoryFormState>(emptyFormState)
  const [additionalSkuInput, setAdditionalSkuInput] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  // Tracks whether the current retail_price was auto-calculated from cost + item type margin
  const [priceAutoCalc, setPriceAutoCalc] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [skuExists, setSkuExists] = useState<{ exists: boolean; source: 'local' | 'cloud' } | null>(
    null
  )
  const [pullingSku, setPullingSku] = useState(false)
  const [activeTab, setActiveTab] = useState('case-settings')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false)
  const tabScrollRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const skuInputRef = useRef<HTMLInputElement | null>(null)
  const sizeInputRef = useRef<HTMLInputElement | null>(null)
  const topHeightRef = useRef<number>(0)
  const [topHeight, setTopHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_TOP_HEIGHT
    const stored = window.localStorage.getItem(TOP_HEIGHT_STORAGE_KEY)
    if (!stored) return DEFAULT_TOP_HEIGHT
    const parsed = Number.parseInt(stored, 10)
    if (!Number.isFinite(parsed) || parsed < TOP_MIN_HEIGHT) return DEFAULT_TOP_HEIGHT
    return parsed
  })

  useEffect(() => {
    topHeightRef.current = topHeight
  }, [topHeight])

  const clampTopHeight = useCallback((next: number): number => {
    const container = containerRef.current
    const containerHeight = container?.clientHeight ?? 0
    const maxTop = Math.max(TOP_MIN_HEIGHT, containerHeight - BOTTOM_MIN_HEIGHT - RESIZE_HANDLE_PX)
    if (containerHeight === 0) {
      return Math.max(TOP_MIN_HEIGHT, next)
    }
    return Math.min(Math.max(next, TOP_MIN_HEIGHT), maxTop)
  }, [])

  const persistTopHeight = useCallback((value: number): void => {
    try {
      window.localStorage.setItem(TOP_HEIGHT_STORAGE_KEY, String(value))
    } catch {
      // ignore storage write failures (private mode)
    }
  }, [])

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      e.preventDefault()
      const startY = e.clientY
      const startTop = topHeightRef.current
      const onMove = (ev: PointerEvent): void => {
        setTopHeight(clampTopHeight(startTop + (ev.clientY - startY)))
      }
      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        persistTopHeight(topHeightRef.current)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [clampTopHeight, persistTopHeight]
  )

  const handleResizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      e.preventDefault()
      const delta = e.key === 'ArrowDown' ? RESIZE_KEYBOARD_STEP : -RESIZE_KEYBOARD_STEP
      setTopHeight((prev) => {
        const next = clampTopHeight(prev + delta)
        persistTopHeight(next)
        return next
      })
    },
    [clampTopHeight, persistTopHeight]
  )

  const handleResizeDoubleClick = useCallback((): void => {
    setTopHeight(clampTopHeight(DEFAULT_TOP_HEIGHT))
    try {
      window.localStorage.removeItem(TOP_HEIGHT_STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [clampTopHeight])

  useEffect(() => {
    if (!tabScrollRef.current) return
    tabScrollRef.current.scrollTop = 0
  }, [activeTab])

  const hasBackendApi =
    typeof api?.searchInventoryProducts === 'function' &&
    typeof api?.getInventoryProductDetail === 'function' &&
    typeof api?.saveInventoryItem === 'function' &&
    typeof api?.getInventoryTaxCodes === 'function' &&
    typeof api?.getDistributors === 'function'
  const debouncedSku = useDebounce(formState.sku.trim(), 400)

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
    if (!hasBackendApi || typeof api?.getItemTypes !== 'function') return
    let active = true
    const loadSizesPromise =
      typeof api?.listSizesInUse === 'function'
        ? api.listSizesInUse()
        : typeof api?.getDistinctSizes === 'function'
          ? api.getDistinctSizes()
          : Promise.resolve<string[]>([])

    void Promise.all([
      api.getItemTypes(),
      api.getInventoryTaxCodes(),
      api.getDistributors(),
      loadSizesPromise
    ])
      .then(([itemTypes, taxCodes, distributors, sizes]) => {
        if (!active) return
        setItemTypeOptions(itemTypes)
        setTaxCodeOptions(taxCodes)
        setDistributorOptions(distributors)
        setSizesInUse(sizes)
      })
      .catch(() => {
        if (!active) return
        setSaveError('Unable to load inventory reference data.')
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
      item_type: detail.item_type ?? '',
      // Cost field accepts up to 3 decimals (distributor cost rounding); render
      // raw numeric form so user-typed precision survives the round-trip.
      cost: formatCostInput(detail.cost),
      retail_price: formatCurrency(detail.retail_price),
      distributor_number:
        detail.distributor_number != null ? String(detail.distributor_number) : '',
      in_stock: String(detail.in_stock),
      tax_rate: filteredTaxRates[0] != null ? String(filteredTaxRates[0]) : '',
      special_pricing: (detail.special_pricing ?? []).map((rule) => ({
        quantity: String(rule.quantity),
        price: formatCurrency(rule.price),
        expires_at: rule.expires_at ? rule.expires_at.slice(0, 10) : ''
      })),
      additional_skus: [...detail.additional_skus],
      bottles_per_case: String(detail.bottles_per_case ?? 12),
      case_discount_price: (() => {
        if (detail.case_discount_price == null) return ''
        const bpc = detail.bottles_per_case ?? 12
        const fullCasePrice = detail.retail_price * bpc
        if (fullCasePrice <= 0) return ''
        const pct = parseFloat(((1 - detail.case_discount_price / fullCasePrice) * 100).toFixed(2))
        return pct > 0 ? String(pct) : ''
      })(),
      case_discount_mode: 'percent' as CaseDiscountMode,
      size: detail.size ?? '',
      case_cost: detail.case_cost != null ? formatCurrency(detail.case_cost) : '',
      nysla_discounts: detail.nysla_discounts ?? '',
      brand_name: detail.brand_name ?? '',
      proof: detail.proof != null ? String(detail.proof) : '',
      alcohol_pct: detail.alcohol_pct != null ? String(detail.alcohol_pct) : '',
      vintage: detail.vintage ?? '',
      ttb_id: detail.ttb_id ?? '',
      display_name: detail.display_name ?? '',
      is_favorite: detail.is_favorite ?? 0,
      is_discontinued: Boolean(detail.is_discontinued)
    })
  }

  const handleNewItem = (): void => {
    setSelectedItem(null)
    setFormState(emptyFormState)
    setShowValidation(false)
    setSuccessMessage('')
    setSaveError('')
    setSkuExists(null)
    setActiveTab('case-settings')
    setPriceAutoCalc(false)
    requestAnimationFrame(() => skuInputRef.current?.focus())
  }

  const startNewWithSku = (sku: string): void => {
    handleNewItem()
    setFormState((prev) => ({ ...prev, sku: sku.replace(/[^A-Za-z0-9-]/g, '').toUpperCase() }))
    requestAnimationFrame(() => skuInputRef.current?.focus())
  }

  const duplicateCurrentAsNew = (): void => {
    setSelectedItem(null)
    setShowValidation(false)
    setSuccessMessage('')
    setSaveError('')
    setSkuExists(null)
    setPriceAutoCalc(false)
    setFormState((current) => ({
      ...current,
      item_number: undefined,
      sku: '',
      additional_skus: []
    }))
    requestAnimationFrame(() => skuInputRef.current?.focus())
  }

  const handleDiscard = (): void => {
    if (selectedItem) {
      applyDetailToForm(selectedItem)
    } else {
      setFormState(emptyFormState)
    }
    setShowValidation(false)
    setSuccessMessage('')
    setSaveError('')
    setSkuExists(null)
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
      setSaveError('Delete is not available in this environment.')
      return
    }
    try {
      await api.deleteInventoryItem(selectedItem.item_number)
      handleNewItem()
      setSuccessMessage('Item deleted')
      onSaveComplete?.()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to delete item')
    }
  }

  const selectItem = async (item: InventoryProduct): Promise<void> => {
    setSuccessMessage('')
    setSaveError('')
    if (!hasBackendApi) return
    try {
      const detail = await api!.getInventoryProductDetail(item.item_number)
      if (detail) {
        applyDetailToForm(detail)
        setShowValidation(false)
      }
    } catch {
      setSaveError('Unable to load item details.')
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
    } else if (
      skuExists?.exists &&
      (!selectedItem ||
        selectedItem.sku.trim().toUpperCase() !== formState.sku.trim().toUpperCase())
    ) {
      errors.sku = 'SKU already exists in your catalog'
    }

    if (!formState.item_name.trim()) {
      errors.item_name = 'Name is required'
    } else if (formState.item_name.trim().length > NAME_MAX_LENGTH) {
      errors.item_name = `Name must be ${NAME_MAX_LENGTH} characters or less`
    }

    if (
      formState.item_type &&
      itemTypeOptions.length > 0 &&
      !itemTypeOptions.some((itemType) => itemType.name === formState.item_type)
    ) {
      errors.item_type = 'Item type must be selected from available values'
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
  }, [formState, isAllowedTaxRate, itemTypeOptions, selectedItem, skuExists, taxCodeOptions.length])

  useEffect(() => {
    if (
      !api?.checkSkuExists ||
      !debouncedSku ||
      !SKU_PATTERN.test(debouncedSku) ||
      debouncedSku.length > SKU_MAX_LENGTH ||
      (selectedItem && selectedItem.sku.trim().toUpperCase() === debouncedSku.toUpperCase())
    ) {
      setSkuExists(null)
      return
    }

    let active = true
    void api
      .checkSkuExists(debouncedSku)
      .then((result) => {
        if (!active) return
        setSkuExists(result.exists ? result : null)
      })
      .catch(() => {
        if (!active) return
        setSkuExists(null)
      })

    return () => {
      active = false
    }
  }, [api, debouncedSku, selectedItem])

  const handlePullSkuFromCloud = async (): Promise<void> => {
    if (!api?.pullProductBySku || !formState.sku.trim()) return
    setPullingSku(true)
    setSaveError('')
    try {
      const detail = await api.pullProductBySku(formState.sku.trim())
      if (!detail) {
        setSaveError('Unable to pull product from cloud.')
        return
      }
      applyDetailToForm(detail)
      setSkuExists(null)
      setSuccessMessage('Item loaded from cloud')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to pull product from cloud.')
    } finally {
      setPullingSku(false)
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  const isFormEmpty = !formState.sku.trim() && !formState.item_name.trim()
  const normalizedCurrentSize = useMemo(() => normalizeSize(formState.size), [formState.size])
  const sizeSuggestions = useMemo(() => {
    const seen = new Set<string>()
    const merged: string[] = []
    const append = (value: string | null | undefined): void => {
      const normalized = normalizeSize(value)
      if (!normalized || seen.has(normalized)) return
      seen.add(normalized)
      merged.push(normalized)
    }

    if (
      normalizedCurrentSize &&
      !CANONICAL_SIZE_SUGGESTIONS.includes(normalizedCurrentSize as never)
    ) {
      append(normalizedCurrentSize)
    }

    sizesInUse.forEach(append)
    CANONICAL_SIZE_SUGGESTIONS.forEach(append)

    return merged
  }, [normalizedCurrentSize, sizesInUse])
  const filteredSizeSuggestions = useMemo(() => {
    const query = formState.size.trim().toUpperCase()
    if (!query) return sizeSuggestions
    return sizeSuggestions.filter((size) => size.toUpperCase().includes(query))
  }, [formState.size, sizeSuggestions])
  const sizeDropdown = useSearchDropdown<string>({
    results: filteredSizeSuggestions,
    isOpen: sizeDropdownOpen,
    onSelect: (value) => {
      setFormState((current) => ({ ...current, size: value }))
      setSizeDropdownOpen(false)
    },
    onOpenChange: setSizeDropdownOpen
  })
  const sizeInputProps = sizeDropdown.getInputProps()

  const handleSizeBlur = useCallback((): void => {
    setSizeDropdownOpen(false)
    setFormState((current) => {
      const normalized = normalizeSize(current.size) ?? ''
      return normalized === current.size ? current : { ...current, size: normalized }
    })
  }, [])

  const handleClearSize = useCallback((): void => {
    setFormState((current) => ({ ...current, size: '' }))
    setSizeDropdownOpen(false)
    sizeInputRef.current?.focus()
  }, [])

  const parsePayload = (): SaveInventoryItemInput | null => {
    const cost = parseDecimalInput(formState.cost, 3)
    const retailPrice = parseCurrencyDigitsToDollars(formState.retail_price)
    const inStock = Number.parseInt(formState.in_stock, 10)

    const specialPricing: SpecialPricingRule[] = formState.special_pricing
      .map((row) => {
        // Treat the date input as end-of-day local so a rule "expiring on
        // 2026-04-30" remains valid for the entire day.
        const expires =
          row.expires_at && row.expires_at.trim()
            ? new Date(`${row.expires_at}T23:59:59`).toISOString()
            : null
        return {
          quantity: Number.parseInt(row.quantity, 10),
          price: parseCurrencyDigitsToDollars(row.price),
          expires_at: expires
        }
      })
      .filter(
        (rule) =>
          Number.isInteger(rule.quantity) &&
          rule.quantity >= 1 &&
          Number.isFinite(rule.price) &&
          rule.price >= 0
      )

    if (Number.isNaN(cost) || Number.isNaN(retailPrice) || Number.isNaN(inStock)) {
      setSaveError('One or more numeric fields are invalid')
      return null
    }

    return {
      item_number: formState.item_number,
      sku: formState.sku.trim(),
      item_name: formState.item_name.trim(),
      item_type: formState.item_type.trim(),
      distributor_number: formState.distributor_number
        ? Number.parseInt(formState.distributor_number, 10)
        : null,
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
        const bpc = formState.bottles_per_case
          ? Number.parseInt(formState.bottles_per_case, 10)
          : 12
        const fullCasePrice = retailPrice * bpc
        if (formState.case_discount_mode === 'percent') {
          const pct = Number.parseFloat(formState.case_discount_price)
          if (Number.isNaN(pct) || pct <= 0) return null
          return Math.round(fullCasePrice * (1 - pct / 100) * 100) / 100
        }
        // Dollar mode: entered amount is the discount off the total case price
        const discountAmount = parseCurrencyDigitsToDollars(formState.case_discount_price)
        return Math.max(0, Math.round((fullCasePrice - discountAmount) * 100) / 100)
      })(),
      size: normalizeSize(formState.size),
      case_cost: formState.case_cost ? parseCurrencyDigitsToDollars(formState.case_cost) : null,
      nysla_discounts: formState.nysla_discounts.trim() || null,
      brand_name: formState.brand_name.trim(),
      proof: formState.proof ? parseFloat(formState.proof) : null,
      alcohol_pct: formState.alcohol_pct ? parseFloat(formState.alcohol_pct) : null,
      vintage: formState.vintage.trim(),
      ttb_id: formState.ttb_id.trim(),
      display_name: formState.display_name.trim(),
      is_favorite: formState.is_favorite,
      is_discontinued: formState.is_discontinued
    }
  }

  const handleSave = async (): Promise<void> => {
    setSuccessMessage('')
    setSaveError('')
    setShowValidation(true)

    if (!hasBackendApi) {
      setSaveError('Backend inventory API is unavailable. Please restart the application.')
      return
    }

    if (hasFieldErrors) return

    const payload = parsePayload()
    if (!payload) return

    try {
      const savedDetail = await api.saveInventoryItem(payload)
      applyDetailToForm(savedDetail)
      setShowValidation(false)
      setSuccessMessage('Item saved')
      onSaveComplete?.()
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Failed to save item'
      setSaveError(
        raw.replace(/^Error invoking( remote)? method '[^']*':\s*(Error:\s*)?/i, '').trim() ||
          'Failed to save item'
      )
    }
  }

  const updateCurrencyField = (
    field: 'cost' | 'retail_price' | 'case_discount_price' | 'case_cost',
    value: string
  ): void => {
    setFormState((current) => ({
      ...current,
      [field]: normalizeCurrencyForInput(value)
    }))
  }

  /** Handle cost change — auto-calculate retail price if an item type with margin is selected.
   *  Formula: price = cost / (1 - margin%), e.g. $10 cost at 30% margin → $14.29 price. */
  const handleCostChange = (value: string): void => {
    // Cost supports up to 3 decimals (distributor cost rounding) — distinct from
    // the 2-decimal shelf price.
    const normalized = normalizeDecimalInput(value, 3)
    setFormState((current) => {
      const updates: Partial<InventoryFormState> = { cost: normalized }
      const itemType = itemTypeOptions.find((option) => option.name === current.item_type)
      if (itemType && itemType.default_profit_margin > 0) {
        const costVal = parseDecimalInput(normalized, 3)
        if (!Number.isNaN(costVal) && costVal > 0) {
          const margin = itemType.default_profit_margin / 100
          updates.retail_price = formatCurrency(costVal / (1 - margin))
          setPriceAutoCalc(true)
          return { ...current, ...updates }
        }
      }
      setPriceAutoCalc(false)
      return { ...current, ...updates }
    })
  }

  /** Handle item type selection — auto-fill default tax code and recalculate price from margin.
   *  Formula: price = cost / (1 - margin%), applied when cost is already entered. */
  const handleItemTypeChange = (itemTypeName: string): void => {
    const itemType = itemTypeOptions.find((option) => option.name === itemTypeName)
    setFormState((current) => {
      const updates: Partial<InventoryFormState> = { item_type: itemTypeName }
      if (itemType) {
        updates.tax_rate =
          itemType.default_tax_rate > 0 ? String(itemType.default_tax_rate / 100) : ''
        if (itemType.default_profit_margin > 0) {
          const costVal = parseDecimalInput(current.cost, 3)
          if (!Number.isNaN(costVal) && costVal > 0) {
            const margin = itemType.default_profit_margin / 100
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
      special_pricing: [...current.special_pricing, { quantity: '', price: '', expires_at: '' }]
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

  /**
   * Gross margin: classic retail formula (price - cost) / price.
   * Net margin folds in the customer-paid tax — useful when comparing items
   * across different tax codes since the customer sees the tax-inclusive price.
   */
  const profitMargin = useMemo(() => {
    const price = parseCurrencyDigitsToDollars(formState.retail_price)
    const cost = parseDecimalInput(formState.cost, 3)
    if (Number.isNaN(price) || price <= 0 || Number.isNaN(cost)) return null
    return ((price - cost) / price) * 100
  }, [formState.retail_price, formState.cost])

  const netMargin = useMemo(() => {
    const price = parseCurrencyDigitsToDollars(formState.retail_price)
    const cost = parseDecimalInput(formState.cost, 3)
    const taxRate = Number.parseFloat(formState.tax_rate || '0')
    if (Number.isNaN(price) || price <= 0 || Number.isNaN(cost)) return null
    const denom = price * (1 + (Number.isFinite(taxRate) ? taxRate : 0))
    if (denom <= 0) return null
    return ((price - cost) / denom) * 100
  }, [formState.retail_price, formState.cost, formState.tax_rate])

  useImperativeHandle(ref, () => ({
    handleNewItem,
    duplicateCurrentAsNew,
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
  const labelCls = 'item-form__label'

  const errCls = 'item-form__field-error'

  const requiredStar = <span className="item-form__required-star">*</span>

  /* ── Tab trigger shared class ── */
  const tabTriggerCls = 'item-form__tab-trigger'

  return (
    <div className="item-form" ref={containerRef}>
      {/* ── General Information ── */}
      <section
        aria-label="General Information"
        className="item-form__section"
        style={{ height: topHeight }}
      >
        {/* Section header band */}
        <div className="item-form__section-header">
          <span className="item-form__section-title">General Information</span>
        </div>

        <div className="item-form__fields">
          {/* ── Row 1: Item Type | SKU | Size ── */}

          {/* Item Type */}
          <div>
            <label className={labelCls}>Item Type</label>
            <InventorySelect
              aria-label="Item Type"
              value={formState.item_type}
              hasError={showValidation && !!fieldErrors.item_type}
              onChange={(e) => {
                const value = e.target.value
                handleItemTypeChange(value)
              }}
            >
              <option value="">None</option>
              {itemTypeOptions.map((itemType) => (
                <option key={itemType.id} value={itemType.name}>
                  {itemType.name}
                </option>
              ))}
            </InventorySelect>
            {showValidation && fieldErrors.item_type && (
              <p className={errCls}>{fieldErrors.item_type}</p>
            )}
          </div>

          {/* SKU */}
          <div>
            <label className={labelCls}>SKU {requiredStar}</label>
            <InventoryInput
              ref={skuInputRef}
              type="text"
              aria-label="SKU"
              hasError={!!fieldErrors.sku && (showValidation || skuExists?.exists === true)}
              className="item-form__sku-input"
              value={formState.sku}
              onChange={(e) => {
                const value = e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
                setSkuExists(null)
                setFormState((c) => ({
                  ...c,
                  sku: value
                }))
              }}
              placeholder="e.g. WINE-001"
              maxLength={SKU_MAX_LENGTH}
            />
            {((showValidation && fieldErrors.sku) || skuExists?.exists) && fieldErrors.sku ? (
              <p className={errCls}>{fieldErrors.sku}</p>
            ) : null}
            {skuExists?.exists && skuExists.source === 'cloud' ? (
              <Button size="sm" variant="outline" onClick={() => void handlePullSkuFromCloud()}>
                {pullingSku ? 'Pulling...' : 'Pull from cloud'}
              </Button>
            ) : null}
          </div>

          {/* Size */}
          <div>
            <label className={labelCls}>Size</label>
            <div className="item-form__size-field">
              <div className="item-form__size-input-wrap">
                <InventoryInput
                  ref={sizeInputRef}
                  type="text"
                  aria-label="Size"
                  value={formState.size}
                  onChange={(event) => {
                    const value = event.target.value
                    setFormState((current) => ({ ...current, size: value }))
                    setSizeDropdownOpen(true)
                  }}
                  onFocus={() => {
                    if (filteredSizeSuggestions.length > 0) setSizeDropdownOpen(true)
                  }}
                  onBlur={handleSizeBlur}
                  onKeyDown={sizeDropdown.handleKeyDown}
                  maxLength={32}
                  className="item-form__size-input"
                  role={sizeInputProps.role}
                  aria-expanded={sizeInputProps['aria-expanded']}
                  aria-controls={sizeInputProps['aria-controls']}
                  aria-autocomplete={sizeInputProps['aria-autocomplete']}
                  aria-activedescendant={sizeInputProps['aria-activedescendant']}
                />
                {formState.size ? (
                  <button
                    type="button"
                    className="item-form__size-clear"
                    aria-label="Clear Size"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      handleClearSize()
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              {sizeDropdownOpen && filteredSizeSuggestions.length > 0 ? (
                <ul id={sizeDropdown.listboxId} role="listbox" className="item-form__size-listbox">
                  {filteredSizeSuggestions.map((size, index) => {
                    const optionProps = sizeDropdown.getOptionProps(index)
                    return (
                      <li
                        key={size}
                        {...optionProps}
                        className={cn(
                          'item-form__size-option',
                          optionProps['aria-selected'] && 'item-form__size-option--highlighted'
                        )}
                      >
                        {size}
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          </div>

          {/* ── Row 2: Brand (×2) | Item (×2) ── */}

          {/* Brand Name */}
          <div className="item-form__field-span-2">
            <label className={labelCls}>Brand</label>
            <InventoryInput
              type="text"
              aria-label="Brand"
              value={formState.brand_name}
              onChange={(e) => {
                const value = e.target.value
                setFormState((c) => ({ ...c, brand_name: value }))
              }}
              placeholder="e.g. Jack Daniel's"
            />
          </div>

          {/* Item */}
          <div className="item-form__field-span-2">
            <label className={labelCls}>Item {requiredStar}</label>
            <InventoryInput
              type="text"
              aria-label="Name"
              hasError={showValidation && !!fieldErrors.item_name}
              value={formState.item_name}
              onChange={(e) => {
                const value = e.target.value
                setFormState((c) => ({ ...c, item_name: value }))
              }}
              maxLength={NAME_MAX_LENGTH}
              placeholder="Item name"
            />
            {showValidation && fieldErrors.item_name && (
              <p className={errCls}>{fieldErrors.item_name}</p>
            )}
          </div>

          {/* Display Name (POS override) */}
          <div className="item-form__field-span-2">
            <label className={labelCls}>Display Name</label>
            <InventoryInput
              type="text"
              aria-label="Display Name"
              value={formState.display_name}
              onChange={(e) => {
                const value = e.target.value
                setFormState((c) => ({ ...c, display_name: value }))
              }}
              maxLength={NAME_MAX_LENGTH}
              placeholder="Optional — overrides Item name on POS"
            />
          </div>

          {/* Per Bottle Cost */}
          <div>
            <label className={labelCls}>Per Bottle Cost {requiredStar}</label>
            <InventoryInput
              type="text"
              aria-label="Per Bottle Cost"
              inputMode="decimal"
              hasError={showValidation && !!fieldErrors.cost}
              className="item-form__cost-input"
              value={formState.cost}
              onChange={(e) => handleCostChange(e.target.value)}
              placeholder="0.000"
            />
            {showValidation && fieldErrors.cost && <p className={errCls}>{fieldErrors.cost}</p>}
          </div>

          {/* Distributor (moved up from Case & Quantity) */}
          <div>
            <label className={labelCls}>Distributor</label>
            <InventorySelect
              aria-label="Distributor"
              value={formState.distributor_number}
              onChange={(e) => {
                const value = e.target.value
                setFormState((c) => ({ ...c, distributor_number: value }))
              }}
            >
              <option value="">None</option>
              {distributorOptions.map((v) => (
                <option key={v.distributor_number} value={String(v.distributor_number)}>
                  {v.distributor_name}
                </option>
              ))}
            </InventorySelect>
          </div>

          {/* ── Row: Price You Charge | # In Stock | Tax Profile ── */}

          {/* Price You Charge */}
          <div>
            <label className={labelCls}>
              Price You Charge {requiredStar}
              {priceAutoCalc && <span className="item-form__auto-badge">auto</span>}
            </label>
            <InventoryInput
              type="text"
              aria-label="Price Charged"
              inputMode="numeric"
              hasError={showValidation && !!fieldErrors.retail_price}
              className="item-form__price-input"
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
              className="item-form__stock-input"
              value={formState.in_stock}
              onChange={(e) => {
                const value = e.target.value
                setFormState((c) => ({ ...c, in_stock: value }))
              }}
              placeholder="0"
            />
            {showValidation && fieldErrors.in_stock && (
              <p className={errCls}>{fieldErrors.in_stock}</p>
            )}
          </div>

          {/* Tax Profile */}
          <div>
            <label className={labelCls}>Tax Profile</label>
            <InventorySelect
              aria-label="Tax Codes"
              value={formState.tax_rate}
              hasError={showValidation && !!fieldErrors.tax_rate}
              onChange={(e) => {
                const value = e.target.value
                setFormState((c) => ({ ...c, tax_rate: value }))
              }}
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

          {/* ── Row 4: Final w/ Tax | Profit Margin (×2) | Discounts ── */}

          {/* Final w/ Tax */}
          <div>
            <label className={labelCls}>Final w/ Tax</label>
            <InventoryInput
              type="text"
              aria-label="Final Price with Tax"
              readOnly
              className="item-form__readonly-input"
              value={finalPriceWithTax != null ? formatCurrency(finalPriceWithTax) : '—'}
            />
          </div>

          {/* Gross Margin: (price - cost) / price */}
          <div>
            <label className={labelCls}>Gross Margin</label>
            <div
              aria-label="Gross Margin"
              className={cn(
                'item-form__margin-display',
                profitMargin == null
                  ? 'item-form__margin-display--none'
                  : profitMargin > 20
                    ? 'item-form__margin-display--high'
                    : profitMargin >= 10
                      ? 'item-form__margin-display--mid'
                      : 'item-form__margin-display--low'
              )}
            >
              {profitMargin != null ? `${profitMargin.toFixed(1)}%` : '—'}
            </div>
          </div>

          {/* Margin after tax: (price - cost) / (price * (1 + tax_rate)).
              Customers see the tax-inclusive price on the shelf — this number
              shows the margin against THAT amount. NOT a true accounting net
              margin (no overhead/processing-fee allocation). See
              docs/features/inventory-v2.md. */}
          <div>
            <label className={labelCls}>Margin after tax</label>
            <div
              aria-label="Margin after tax"
              className={cn(
                'item-form__margin-display',
                netMargin == null
                  ? 'item-form__margin-display--none'
                  : netMargin > 20
                    ? 'item-form__margin-display--high'
                    : netMargin >= 10
                      ? 'item-form__margin-display--mid'
                      : 'item-form__margin-display--low'
              )}
            >
              {netMargin != null ? `${netMargin.toFixed(1)}%` : '—'}
            </div>
          </div>

          {/* Discounts */}
          <div>
            <label className={labelCls}>Discounts</label>
            <div className="item-form__discounts-display" aria-label="NYSLA Discounts">
              {formState.nysla_discounts ? (
                (() => {
                  try {
                    const tiers = JSON.parse(formState.nysla_discounts) as NyslaDiscount[]
                    return tiers.map((tier, i) => (
                      <span key={i} className="item-form__discount-tier">
                        {formatCurrency(tier.amount)} on {tier.min_cases} Case
                      </span>
                    ))
                  } catch {
                    return <span className="item-form__discount-tier">—</span>
                  }
                })()
              ) : (
                <span className="item-form__discount-tier item-form__discount-tier--none">—</span>
              )}
            </div>
          </div>

          {/* ── Bottom row: visibility flags ── */}
          <div className="item-form__field-span-2 item-form__visibility-flag">
            <label className="item-form__checkbox-label">
              <Checkbox
                checked={formState.is_favorite === 1}
                onCheckedChange={(checked) =>
                  setFormState((c) => ({ ...c, is_favorite: checked === true ? 1 : 0 }))
                }
              />
              Show on Favorites tab
            </label>
          </div>

          <div className="item-form__field-span-2 item-form__visibility-flag">
            <label className="item-form__checkbox-label">
              <Checkbox
                checked={formState.is_discontinued}
                onCheckedChange={(checked) =>
                  setFormState((current) => ({
                    ...current,
                    is_discontinued: checked === true
                  }))
                }
              />
              Discontinued - exclude from reorder suggestions
            </label>
          </div>
        </div>
      </section>

      {/* ── Resize handle ── */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize inventory sections"
        tabIndex={0}
        className="item-form__resize-handle"
        onPointerDown={handleResizePointerDown}
        onKeyDown={handleResizeKeyDown}
        onDoubleClick={handleResizeDoubleClick}
        data-testid="item-form-resize-handle"
      />

      {/* ── Inner Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="item-form__tabs">
        <TabsList className="item-form__tab-list">
          <TabsTrigger value="case-settings" disabled={isFormEmpty} className={tabTriggerCls}>
            Case &amp; Quantity
          </TabsTrigger>
          <TabsTrigger value="additional-skus" disabled={isFormEmpty} className={tabTriggerCls}>
            Additional SKUs
          </TabsTrigger>
          <TabsTrigger value="special-pricing" disabled={isFormEmpty} className={tabTriggerCls}>
            Special Pricing
          </TabsTrigger>
          <TabsTrigger value="additional-info" disabled={isFormEmpty} className={tabTriggerCls}>
            Additional Info
          </TabsTrigger>
          <TabsTrigger value="sales-history" disabled={isFormEmpty} className={tabTriggerCls}>
            Sales History
          </TabsTrigger>
        </TabsList>

        <div className="item-form__tab-scroll" ref={tabScrollRef}>
          {/* Case & Quantity */}
          <TabsContent value="case-settings" className="item-form__tab-panel">
            <div className="item-form__case-grid">
              <FormField label="Bottles Per Case">
                <InventoryInput
                  type="text"
                  aria-label="Bottles Per Case"
                  inputMode="numeric"
                  value={formState.bottles_per_case}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '')
                    setFormState((c) => ({
                      ...c,
                      bottles_per_case: value
                    }))
                  }}
                  placeholder="e.g. 12"
                />
              </FormField>
              <FormField label="Per Case Cost">
                <InventoryInput
                  type="text"
                  aria-label="Per Case Cost"
                  inputMode="numeric"
                  value={formState.case_cost}
                  onChange={(e) => updateCurrencyField('case_cost', e.target.value)}
                  placeholder="$0.00"
                />
              </FormField>
              <FormField label="Case Discount">
                <div
                  className="item-form__case-mode-field"
                  data-mode={formState.case_discount_mode}
                >
                  {formState.case_discount_mode === 'percent' ? (
                    <Input
                      className="item-form__case-mode-input"
                      aria-label="Case Discount Percent"
                      inputMode="decimal"
                      value={formState.case_discount_price}
                      onChange={(event) => {
                        const raw = event.target.value.replace(/[^0-9.]/g, '')
                        setFormState((current) => ({ ...current, case_discount_price: raw }))
                      }}
                      placeholder="e.g. 10%"
                    />
                  ) : (
                    <Input
                      className="item-form__case-mode-input"
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
                    className="item-form__case-mode-toggle"
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
                    <ToggleGroupItem
                      className="item-form__case-mode-toggle-item"
                      value="percent"
                      aria-label="Switch to percent mode"
                    >
                      %
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      className="item-form__case-mode-toggle-item"
                      value="dollar"
                      aria-label="Switch to dollar mode"
                    >
                      $
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </FormField>
            </div>
            <p className="item-form__case-hint">
              Set the number of bottles in a case to enable case-level inventory and pricing.
              {formState.case_discount_mode === 'percent'
                ? ' Enter the discount percentage off the full case price.'
                : ' The case discount price is the total price when selling a full case.'}
            </p>
          </TabsContent>

          {/* Additional SKUs */}
          <TabsContent value="additional-skus" className="item-form__tab-panel">
            <div className="item-form__add-sku-row">
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
              <ul className="item-form__sku-list">
                {formState.additional_skus.map((sku) => (
                  <li key={sku} className="item-form__sku-item">
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
          <TabsContent value="special-pricing" className="item-form__tab-panel">
            <div className="item-form__sp-header">
              <Label>Set quantity-based pricing deals (e.g. 2 bottles for $19.99)</Label>
              <Button size="sm" onClick={addSpecialPricingRow}>
                Add Rule
              </Button>
            </div>
            {formState.special_pricing.length === 0 ? (
              <p className="item-form__sp-empty">
                No special pricing rules. Click &quot;Add Rule&quot; to create one.
              </p>
            ) : (
              <table className="item-form__sp-table" aria-label="Special Pricing Rules">
                <thead>
                  <tr>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Expires</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {formState.special_pricing.map((row, index) => (
                    <tr key={index}>
                      <td>
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
                      <td>
                        <Input
                          aria-label={`Rule ${index + 1} Price`}
                          inputMode="numeric"
                          placeholder="e.g. $19.99 total"
                          value={row.price}
                          onChange={(e) => updateSpecialPricingRow(index, 'price', e.target.value)}
                        />
                      </td>
                      <td>
                        <Input
                          type="date"
                          aria-label={`Rule ${index + 1} Expires`}
                          value={row.expires_at}
                          onChange={(e) =>
                            updateSpecialPricingRow(index, 'expires_at', e.target.value)
                          }
                        />
                      </td>
                      <td>
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

          {/* Additional Info */}
          <TabsContent value="additional-info" className="item-form__tab-panel">
            <div className="item-form__case-grid">
              <FormField label="Proof">
                <InventoryInput
                  type="text"
                  aria-label="Proof"
                  inputMode="decimal"
                  value={formState.proof}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '')
                    setFormState((c) => ({ ...c, proof: value }))
                  }}
                  placeholder="e.g. 80"
                />
              </FormField>
              <FormField label="ABV %">
                <InventoryInput
                  type="text"
                  aria-label="ABV Percent"
                  inputMode="decimal"
                  value={formState.alcohol_pct}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '')
                    setFormState((c) => ({
                      ...c,
                      alcohol_pct: value
                    }))
                  }}
                  placeholder="e.g. 40"
                />
              </FormField>
              <FormField label="Vintage">
                <InventoryInput
                  type="text"
                  aria-label="Vintage"
                  inputMode="numeric"
                  value={formState.vintage}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '')
                    setFormState((c) => ({
                      ...c,
                      vintage: value
                    }))
                  }}
                  placeholder="e.g. 2020"
                  maxLength={4}
                />
              </FormField>
              <FormField label="TTB ID">
                <InventoryInput
                  type="text"
                  aria-label="TTB ID"
                  autoComplete="off"
                  spellCheck={false}
                  value={formState.ttb_id}
                  onChange={(e) => {
                    const value = e.target.value
                    setFormState((c) => ({
                      ...c,
                      ttb_id: value
                    }))
                  }}
                  placeholder="e.g. 12345678"
                />
              </FormField>
            </div>
          </TabsContent>

          {/* Sales History */}
          <TabsContent value="sales-history" className="item-form__tab-panel">
            {!selectedItem || selectedItem.sales_history.length === 0 ? (
              <p className="item-form__sh-empty">No sales history found</p>
            ) : (
              <table className="item-form__sh-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Txn #</th>
                    <th>Qty</th>
                    <th>Cost</th>
                    <th>Price</th>
                    <th>Total</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItem.sales_history.map((h) => {
                    const isRefund = h.status === 'refund'
                    const refundColor = 'var(--semantic-danger-text)'
                    return (
                      <tr
                        key={`${h.transaction_id}-${h.created_at}`}
                        style={isRefund ? { background: 'rgba(127, 29, 29, 0.15)' } : undefined}
                      >
                        <td>{new Date(h.created_at).toLocaleDateString()}</td>
                        <td className="item-form__sh-td--mono">
                          {h.transaction_number ? (
                            <button
                              type="button"
                              className="item-form__sh-txn-link"
                              onClick={() => onRecallTransaction?.(h.transaction_number)}
                              data-testid="txn-link"
                            >
                              {h.transaction_number}
                            </button>
                          ) : (
                            `#${h.transaction_id}`
                          )}
                        </td>
                        <td
                          className="item-form__sh-td--bold"
                          style={isRefund ? { color: refundColor } : undefined}
                        >
                          {isRefund ? `-${h.quantity}` : h.quantity}
                        </td>
                        <td style={isRefund ? { color: refundColor } : undefined}>
                          {h.cost_at_sale != null && h.cost_at_sale > 0
                            ? formatCurrency(h.cost_at_sale)
                            : '—'}
                        </td>
                        <td style={isRefund ? { color: refundColor } : undefined}>
                          {isRefund
                            ? `(${formatCurrency(h.unit_price)})`
                            : formatCurrency(h.unit_price)}
                        </td>
                        <td
                          className="item-form__sh-td--bold"
                          style={isRefund ? { color: refundColor } : undefined}
                        >
                          {isRefund
                            ? `(${formatCurrency(h.total_price)})`
                            : formatCurrency(h.total_price)}
                        </td>
                        <td>
                          {h.payment_method ?? '—'}
                          {h.card_type && h.card_last_four && (
                            <span className="item-form__sh-card-info">
                              {' '}
                              ({h.card_type} ****{h.card_last_four})
                            </span>
                          )}
                          {isRefund && (
                            <span
                              className="item-form__sh-refund-badge"
                              style={{
                                background: 'rgba(127, 29, 29, 0.4)',
                                color: '#fca5a5'
                              }}
                            >
                              REFUND
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </TabsContent>
        </div>
      </Tabs>

      <SuccessModal
        isOpen={!!successMessage}
        message={successMessage}
        onDismiss={() => setSuccessMessage('')}
      />

      <ErrorModal isOpen={!!saveError} message={saveError} onDismiss={() => setSaveError('')} />

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
