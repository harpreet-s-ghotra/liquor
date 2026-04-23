import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn()
}))

vi.mock('./supabase', () => ({
  supabaseAuth: {
    auth: {
      getSession
    }
  }
}))

import { fetchMerchants } from './api'

describe('catalog-admin api client', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'test-access-token'
        }
      }
    })
    global.fetch = vi.fn()
  })

  it('explains how to start the local api when an api route returns 404', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain'
        }
      })
    )

    await expect(fetchMerchants()).rejects.toThrow(
      'Catalog admin API route not found. Start the local admin server with "npm run admin" from the repo root or "npm run dev" in tools/catalog-admin.'
    )

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/merchants',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
          'Content-Type': 'application/json'
        })
      })
    )
  })
})