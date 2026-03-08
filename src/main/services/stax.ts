import type {
  StaxMerchantInfo,
  TerminalChargeInput,
  TerminalChargeResult,
  TerminalRegister
} from '../../shared/types'

const STAX_API_URL = 'https://apiprod.fattlabs.com'

/** Polling interval in milliseconds */
const POLL_INTERVAL_MS = 2000
/** Maximum number of poll attempts (2s × 60 = 2 minutes) */
const MAX_POLL_ATTEMPTS = 60

export class StaxApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: unknown
  ) {
    super(message)
    this.name = 'StaxApiError'
  }
}

/** Helper: make an authenticated request to Stax API */
async function staxFetch(
  apiKey: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(`${STAX_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  })
  return response
}

/**
 * Validate a Stax API key by calling GET /self.
 * Returns merchant info if the key is valid, throws StaxApiError otherwise.
 */
export async function validateApiKey(apiKey: string): Promise<StaxMerchantInfo> {
  const response = await staxFetch(apiKey, '/self')

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new StaxApiError(
      `Stax API key validation failed (HTTP ${response.status})`,
      response.status,
      body
    )
  }

  const data = await response.json()
  const merchant = data.merchant ?? data

  if (!merchant?.id) {
    throw new StaxApiError('Invalid response from Stax API — no merchant data', 200, data)
  }

  return {
    merchant_id: merchant.id,
    company_name: merchant.company_name ?? merchant.business_name ?? 'Unknown',
    status: merchant.status ?? 'unknown'
  }
}

/**
 * Get all registered terminal devices (card readers) for this merchant.
 */
export async function getTerminalRegisters(apiKey: string): Promise<TerminalRegister[]> {
  const response = await staxFetch(apiKey, '/terminal/register')

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new StaxApiError(
      `Failed to get terminal registers (HTTP ${response.status})`,
      response.status,
      body
    )
  }

  const data = await response.json()
  const registers: unknown[] = Array.isArray(data) ? data : (data?.data ?? [])

  return registers.map((r) => {
    const reg = r as Record<string, unknown>
    return {
      id: String(reg.id ?? ''),
      nickname: String(reg.nickname ?? ''),
      serial: String(reg.serial ?? ''),
      type: String(reg.type ?? ''),
      model: String(reg.model ?? ''),
      is_default: Boolean(reg.isDefault ?? reg.is_default ?? false),
      register_num: Number(reg.register_num ?? 0)
    }
  })
}

/**
 * Send a charge to a physical card terminal and poll until the transaction
 * is approved, declined, or times out.
 *
 * Flow:
 *  1. GET /terminal/register → find default register
 *  2. POST /terminal/charge → initiate charge (terminal shows "Insert Card")
 *  3. Poll GET /terminal/{registerId}/status/{transactionId} until done
 */
export async function chargeTerminal(
  apiKey: string,
  input: TerminalChargeInput
): Promise<TerminalChargeResult> {
  // Step 1: Get registers and find the default one
  const registers = await getTerminalRegisters(apiKey)
  if (registers.length === 0) {
    throw new StaxApiError('No terminal devices found — pair a card reader first', 0)
  }
  const register = registers.find((r) => r.is_default) ?? registers[0]

  // Step 2: Initiate charge on the terminal
  const chargeResponse = await staxFetch(apiKey, '/terminal/charge', {
    method: 'POST',
    body: JSON.stringify({
      total: input.total,
      register: register.id,
      payment_type: input.payment_type,
      meta: {
        ...(input.meta ?? {}),
        source: 'liquor-pos'
      }
    })
  })

  if (!chargeResponse.ok) {
    const body = await chargeResponse.text().catch(() => '')
    throw new StaxApiError(
      `Terminal charge failed (HTTP ${chargeResponse.status})`,
      chargeResponse.status,
      body
    )
  }

  const chargeData = await chargeResponse.json()
  const transactionId: string = chargeData.id ?? ''

  if (!transactionId) {
    throw new StaxApiError('No transaction ID returned from terminal charge', 0, chargeData)
  }

  // Step 3: Poll for terminal status until approved/declined/timeout
  return pollTerminalStatus(apiKey, register.id, transactionId, input)
}

/**
 * Poll the terminal status endpoint until the transaction reaches a final state.
 */
async function pollTerminalStatus(
  apiKey: string,
  registerId: string,
  transactionId: string,
  input: TerminalChargeInput
): Promise<TerminalChargeResult> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS)

    const statusResponse = await staxFetch(
      apiKey,
      `/terminal/${registerId}/status/${transactionId}`
    )

    if (!statusResponse.ok) {
      // Non-fatal: terminal may not be ready yet, keep polling
      continue
    }

    const data = await statusResponse.json()

    // Still waiting for customer to insert/tap card
    if (data.message === 'terminalservice.waiting' || data.status === 'pending') {
      continue
    }

    // Transaction reached a final state
    const success = data.success === true || data.is_captured === true || data.is_captured === 1

    return {
      transaction_id: transactionId,
      success,
      last_four: String(data.last_four ?? data.payment_method?.card_last_four ?? ''),
      card_type: String(data.card_type ?? data.payment_method?.card_type ?? 'unknown'),
      total: Number(data.total ?? input.total),
      message: String(data.message ?? (success ? 'Approved' : 'Declined')),
      status: success ? 'approved' : 'declined'
    }
  }

  // Timed out waiting for terminal
  return {
    transaction_id: transactionId,
    success: false,
    last_four: '',
    card_type: 'unknown',
    total: input.total,
    message: 'Terminal timed out — no response from card reader',
    status: 'timeout'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
