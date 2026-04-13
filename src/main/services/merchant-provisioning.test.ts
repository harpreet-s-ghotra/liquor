import { describe, expect, it, vi } from 'vitest'
import {
  deriveMerchantNameFromEmail,
  provisionMerchantForUser,
  provisionMerchantInvite
} from './merchant-provisioning'

describe('merchant provisioning', () => {
  it('derives a readable merchant name from email', () => {
    expect(deriveMerchantNameFromEmail('harpreetghotra40@icloud.com')).toBe('Harpreetghotra Store')
    expect(deriveMerchantNameFromEmail('my.cool-store@example.com')).toBe('My Cool Store Store')
    expect(deriveMerchantNameFromEmail('12345@example.com')).toBe('New Merchant')
  })

  it('invites a new user and provisions the merchant row', async () => {
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1', email: 'invite@example.com' } },
      error: null
    })
    const listUsers = vi.fn().mockResolvedValue({ data: { users: [] }, error: null })
    const upsert = vi.fn().mockResolvedValue({ error: null })

    const result = await provisionMerchantInvite(
      {
        auth: { admin: { listUsers, inviteUserByEmail } },
        from: vi.fn().mockReturnValue({ upsert })
      },
      {
        email: 'invite@example.com',
        redirectTo: 'liquorpos://auth/callback'
      }
    )

    expect(inviteUserByEmail).toHaveBeenCalledWith('invite@example.com', {
      redirectTo: 'liquorpos://auth/callback'
    })
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        merchant_name: 'Invite Store',
        finix_merchant_id: null
      },
      { onConflict: 'user_id' }
    )
    expect(result).toEqual({ userId: 'user-1', merchantName: 'Invite Store', invited: true })
  })

  it('reuses an existing auth user and only provisions the merchant row', async () => {
    const inviteUserByEmail = vi.fn()
    const listUsers = vi.fn().mockResolvedValue({
      data: { users: [{ id: 'user-2', email: 'existing@example.com' }] },
      error: null
    })
    const upsert = vi.fn().mockResolvedValue({ error: null })

    const result = await provisionMerchantInvite(
      {
        auth: { admin: { listUsers, inviteUserByEmail } },
        from: vi.fn().mockReturnValue({ upsert })
      },
      {
        email: 'existing@example.com',
        merchantName: 'Existing Store'
      }
    )

    expect(inviteUserByEmail).not.toHaveBeenCalled()
    expect(result).toEqual({ userId: 'user-2', merchantName: 'Existing Store', invited: false })
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-2',
        merchant_name: 'Existing Store',
        finix_merchant_id: null
      },
      { onConflict: 'user_id' }
    )
  })

  it('provisions a merchant row for an already-authenticated user', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })

    const result = await provisionMerchantForUser(
      {
        auth: {
          admin: {
            listUsers: vi.fn(),
            inviteUserByEmail: vi.fn()
          }
        },
        from: vi.fn().mockReturnValue({ upsert })
      },
      {
        userId: 'user-3',
        email: 'manualinvite@example.com'
      }
    )

    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-3',
        merchant_name: 'Manualinvite Store',
        finix_merchant_id: null
      },
      { onConflict: 'user_id' }
    )
    expect(result).toEqual({ userId: 'user-3', merchantName: 'Manualinvite Store' })
  })

  it('throws when upsert fails during provisionMerchantForUser', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'DB constraint violation' } })

    await expect(
      provisionMerchantForUser(
        {
          auth: { admin: { listUsers: vi.fn(), inviteUserByEmail: vi.fn() } },
          from: vi.fn().mockReturnValue({ upsert })
        },
        { userId: 'user-4', email: 'fail@example.com' }
      )
    ).rejects.toThrow('Failed to provision merchant row: DB constraint violation')
  })

  it('throws when invite API returns an error', async () => {
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'User already registered' }
    })
    const listUsers = vi.fn().mockResolvedValue({ data: { users: [] }, error: null })

    await expect(
      provisionMerchantInvite(
        {
          auth: { admin: { listUsers, inviteUserByEmail } },
          from: vi.fn().mockReturnValue({ upsert: vi.fn() })
        },
        { email: 'taken@example.com' }
      )
    ).rejects.toThrow('User already registered')
  })

  it('throws when listUsers fails in findUserByEmail', async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Unauthorized' }
    })

    await expect(
      provisionMerchantInvite(
        {
          auth: { admin: { listUsers, inviteUserByEmail: vi.fn() } },
          from: vi.fn().mockReturnValue({ upsert: vi.fn() })
        },
        { email: 'test@example.com' }
      )
    ).rejects.toThrow('Failed to list auth users: Unauthorized')
  })

  it('paginates when first page returns exactly 200 users', async () => {
    const page1Users = Array.from({ length: 200 }, (_, i) => ({
      id: `uid-${i}`,
      email: `user${i}@example.com`
    }))
    const page2Users = [{ id: 'target-id', email: 'target@example.com' }]
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { users: page1Users }, error: null })
      .mockResolvedValueOnce({ data: { users: page2Users }, error: null })
    const upsert = vi.fn().mockResolvedValue({ error: null })

    const result = await provisionMerchantInvite(
      {
        auth: { admin: { listUsers, inviteUserByEmail: vi.fn() } },
        from: vi.fn().mockReturnValue({ upsert })
      },
      { email: 'target@example.com', merchantName: 'Target Store' }
    )

    expect(listUsers).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ userId: 'target-id', merchantName: 'Target Store', invited: false })
  })

  it('uses deriveMerchantNameFromEmail when no merchantName is provided', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })

    const result = await provisionMerchantForUser(
      {
        auth: { admin: { listUsers: vi.fn(), inviteUserByEmail: vi.fn() } },
        from: vi.fn().mockReturnValue({ upsert })
      },
      { userId: 'user-5', email: 'liquorking@example.com' }
    )

    expect(result.merchantName).toBe('Liquorking Store')
  })
})
