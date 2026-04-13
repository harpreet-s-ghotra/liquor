import type {
  FinixCardInput,
  FinixChargeResult,
  FinixCreateDeviceInput,
  FinixDevice,
  FinixTerminalChargeInput
} from '../../shared/types'

const FINIX_API_URL = process.env.FINIX_API_URL ?? 'https://finix.sandbox-payments-api.com'
const FINIX_VERSION = '2022-02-01'

export class FinixApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: unknown
  ) {
    super(message)
    this.name = 'FinixApiError'
  }
}

/** Build HTTP Basic Auth header from username + password */
function basicAuth(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}

/** Make an authenticated request to the Finix API */
async function finixFetch(
  username: string,
  password: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${FINIX_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: basicAuth(username, password),
      'Content-Type': 'application/json',
      'Finix-Version': FINIX_VERSION,
      ...(options.headers ?? {})
    }
  })
}

/** Parse a Finix error response into a readable message */
async function parseFinixError(response: Response, context: string): Promise<FinixApiError> {
  const body = await response.json().catch(() => null)
  const errors = (body as { _embedded?: { errors?: Array<{ message?: string }> } } | null)
    ?._embedded?.errors
  const message = errors?.[0]?.message ?? `${context} (HTTP ${response.status})`
  return new FinixApiError(message, response.status, body)
}

/**
 * Verify a Finix merchant is active and ready to process payments.
 */
export async function verifyMerchant(
  username: string,
  password: string,
  merchantId: string
): Promise<{ merchant_id: string; merchant_name: string; processing_enabled: boolean }> {
  const response = await finixFetch(username, password, `/merchants/${merchantId}`)

  if (!response.ok) {
    throw await parseFinixError(response, 'Merchant verification failed')
  }

  const data = (await response.json()) as {
    id: string
    merchant_name: string
    processing_enabled: boolean
    onboarding_state: string
  }

  return {
    merchant_id: data.id,
    merchant_name: data.merchant_name ?? '',
    processing_enabled: data.processing_enabled ?? false
  }
}

/**
 * List all devices registered under a merchant.
 */
export async function listDevices(
  username: string,
  password: string,
  merchantId: string
): Promise<FinixDevice[]> {
  const response = await finixFetch(username, password, `/merchants/${merchantId}/devices`)

  if (!response.ok) {
    throw await parseFinixError(response, 'Failed to list devices')
  }

  const data = (await response.json()) as {
    _embedded?: { devices?: Array<Record<string, unknown>> }
  }
  const devices = data._embedded?.devices ?? []

  return devices.map((d) => ({
    id: String(d.id ?? ''),
    name: String(d.name ?? ''),
    model: (d.model as FinixDevice['model']) ?? 'PAX_A920PRO',
    serial_number: d.serial_number ? String(d.serial_number) : null,
    enabled: Boolean(d.enabled ?? false),
    merchant: String(d.merchant ?? merchantId)
  }))
}

/**
 * Register a new PAX terminal device under a merchant.
 */
export async function createDevice(
  username: string,
  password: string,
  merchantId: string,
  input: FinixCreateDeviceInput
): Promise<FinixDevice> {
  const response = await finixFetch(username, password, `/merchants/${merchantId}/devices`, {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      model: input.model,
      serial_number: input.serial_number,
      configuration: {
        allow_debit: true,
        bypass_device_on_capture: true,
        prompt_receipt_confirmation: false
      }
    })
  })

  if (!response.ok) {
    throw await parseFinixError(response, 'Failed to create device')
  }

  const d = (await response.json()) as Record<string, unknown>
  return {
    id: String(d.id ?? ''),
    name: String(d.name ?? ''),
    model: (d.model as FinixDevice['model']) ?? input.model,
    serial_number: d.serial_number ? String(d.serial_number) : null,
    enabled: Boolean(d.enabled ?? false),
    merchant: String(d.merchant ?? merchantId)
  }
}

/**
 * Phase A: Tokenize a card and charge it (auth + immediate capture).
 * Used when no hardware terminal is present.
 */
export async function chargeWithCard(
  username: string,
  password: string,
  merchantId: string,
  input: FinixCardInput
): Promise<FinixChargeResult> {
  const totalCents = Math.round(input.total * 100)

  // Step 1: Create a buyer identity for this card holder
  const buyerResponse = await finixFetch(username, password, '/identities', {
    method: 'POST',
    body: JSON.stringify({
      entity: {
        first_name: input.person_name.split(' ')[0] || 'Card',
        last_name: input.person_name.split(' ').slice(1).join(' ') || 'Holder',
        email: 'customer@example.com'
      }
    })
  })

  if (!buyerResponse.ok) {
    throw await parseFinixError(buyerResponse, 'Failed to create buyer identity')
  }

  const buyer = (await buyerResponse.json()) as { id: string }

  // Step 2: Tokenize the card as a payment instrument (identity required by Finix)
  const [expMonth, expYear] = parseCardExp(input.card_exp)
  const piResponse = await finixFetch(username, password, '/payment_instruments', {
    method: 'POST',
    body: JSON.stringify({
      type: 'PAYMENT_CARD',
      identity: buyer.id,
      number: input.card_number,
      expiration_month: expMonth,
      expiration_year: expYear,
      security_code: input.card_cvv,
      name: input.person_name,
      ...(input.address_zip ? { address: { postal_code: input.address_zip } } : {})
    })
  })

  if (!piResponse.ok) {
    throw await parseFinixError(piResponse, 'Failed to tokenize card')
  }

  const pi = (await piResponse.json()) as { id: string }

  // Step 3: Create an authorization
  const authResponse = await finixFetch(username, password, '/authorizations', {
    method: 'POST',
    body: JSON.stringify({
      source: pi.id,
      merchant: merchantId,
      amount: totalCents,
      currency: 'USD',
      operation_key: 'AUTHORIZATION',
      tags: { source: 'liquor-pos' }
    })
  })

  if (!authResponse.ok) {
    throw await parseFinixError(authResponse, 'Authorization failed')
  }

  const auth = (await authResponse.json()) as {
    id: string
    state: string
    amount: number
    failure_code: string | null
    failure_message: string | null
    tags?: Record<string, string>
  }

  if (auth.state === 'FAILED') {
    return {
      authorization_id: auth.id,
      transfer_id: '',
      success: false,
      last_four: input.card_number.slice(-4),
      card_type: 'unknown',
      total: input.total,
      message: auth.failure_message ?? 'Card declined',
      status: 'declined'
    }
  }

  // Step 4: Immediately capture the authorization
  return captureAuthorization(username, password, auth.id, totalCents, input.card_number.slice(-4))
}

/**
 * Phase B: Card-present charge via PAX terminal (auth + immediate capture).
 */
export async function chargeTerminal(
  username: string,
  password: string,
  input: FinixTerminalChargeInput
): Promise<FinixChargeResult> {
  // Create a card-present authorization (terminal handles card read)
  const authResponse = await finixFetch(username, password, '/authorizations', {
    method: 'POST',
    body: JSON.stringify({
      device: input.device_id,
      amount: input.total,
      currency: 'USD',
      operation_key: 'CARD_PRESENT_AUTHORIZATION',
      tags: { source: 'liquor-pos' }
    })
  })

  if (!authResponse.ok) {
    throw await parseFinixError(authResponse, 'Terminal authorization failed')
  }

  const auth = (await authResponse.json()) as {
    id: string
    state: string
    amount: number
    failure_code: string | null
    failure_message: string | null
    card_present_details?: {
      brand?: string
      masked_account_number?: string
    }
  }

  if (auth.state === 'FAILED') {
    return {
      authorization_id: auth.id,
      transfer_id: '',
      success: false,
      last_four: '',
      card_type: 'unknown',
      total: input.total / 100,
      message: auth.failure_message ?? 'Card declined',
      status: 'declined'
    }
  }

  const lastFour = auth.card_present_details?.masked_account_number?.slice(-4) ?? ''
  const cardType = auth.card_present_details?.brand ?? 'unknown'

  return captureAuthorization(username, password, auth.id, auth.amount, lastFour, cardType)
}

/**
 * Void an uncaptured authorization.
 */
export async function voidAuthorization(
  username: string,
  password: string,
  authorizationId: string
): Promise<void> {
  const response = await finixFetch(username, password, `/authorizations/${authorizationId}`, {
    method: 'PUT',
    body: JSON.stringify({ void_me: true })
  })

  if (!response.ok) {
    throw await parseFinixError(response, 'Failed to void authorization')
  }
}

/**
 * Refund a captured transfer (partial or full).
 */
export async function refundTransfer(
  username: string,
  password: string,
  transferId: string,
  refundAmountCents: number
): Promise<void> {
  const response = await finixFetch(username, password, `/transfers/${transferId}/reversals`, {
    method: 'POST',
    body: JSON.stringify({ refund_amount: refundAmountCents })
  })

  if (!response.ok) {
    throw await parseFinixError(response, 'Failed to refund transfer')
  }
}

// ── Helpers ──

/** Parse MMYY card expiry string into [month, year] integers */
function parseCardExp(cardExp: string): [number, number] {
  const cleaned = cardExp.replace(/\D/g, '')
  if (cleaned.length === 4) {
    return [parseInt(cleaned.slice(0, 2), 10), parseInt(cleaned.slice(2, 4), 10) + 2000]
  }
  // MMYYYY or MM/YY fallback
  const month = parseInt(cleaned.slice(0, 2), 10)
  const yearPart = cleaned.slice(2)
  const year = yearPart.length === 2 ? 2000 + parseInt(yearPart, 10) : parseInt(yearPart, 10)
  return [month, year]
}

/** Capture an authorization and return the unified FinixChargeResult */
async function captureAuthorization(
  username: string,
  password: string,
  authorizationId: string,
  captureAmountCents: number,
  lastFour: string,
  cardType = 'unknown'
): Promise<FinixChargeResult> {
  const captureResponse = await finixFetch(
    username,
    password,
    `/authorizations/${authorizationId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ capture_amount: captureAmountCents })
    }
  )

  if (!captureResponse.ok) {
    throw await parseFinixError(captureResponse, 'Capture failed')
  }

  const captured = (await captureResponse.json()) as {
    id: string
    state: string
    transfer: string | null
    amount: number
    failure_message: string | null
    card_present_details?: {
      brand?: string
      masked_account_number?: string
    }
  }

  // Use card_present_details from capture response when available (terminal path)
  const resolvedLastFour =
    captured.card_present_details?.masked_account_number?.slice(-4) ?? lastFour
  const resolvedCardType = captured.card_present_details?.brand ?? cardType
  const success = captured.state === 'SUCCEEDED' || captured.transfer != null

  return {
    authorization_id: captured.id,
    transfer_id: captured.transfer ?? '',
    success,
    last_four: resolvedLastFour,
    card_type: resolvedCardType,
    total: captured.amount / 100,
    message: success ? 'Approved' : (captured.failure_message ?? 'Payment failed'),
    status: success ? 'approved' : 'declined'
  }
}
