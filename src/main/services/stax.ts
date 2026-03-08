import type { StaxMerchantInfo } from '../../shared/types'

const STAX_API_URL = 'https://apiprod.fattlabs.com'

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

/**
 * Validate a Stax API key by calling GET /self.
 * Returns merchant info if the key is valid, throws StaxApiError otherwise.
 */
export async function validateApiKey(apiKey: string): Promise<StaxMerchantInfo> {
  const response = await fetch(`${STAX_API_URL}/self`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new StaxApiError(
      `Stax API key validation failed (HTTP ${response.status})`,
      response.status,
      body
    )
  }

  const data = await response.json()

  // The /self endpoint returns the user with a nested merchant object
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
