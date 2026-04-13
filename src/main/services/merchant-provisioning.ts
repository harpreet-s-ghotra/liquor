type MerchantUpsertValues = {
  user_id: string
  merchant_name: string
  finix_merchant_id: string | null
}

type AdminUser = {
  id: string
  email?: string | null
}

type ListUsersResult = {
  data?: { users: AdminUser[] }
  error?: { message: string } | null
}

type InviteUserResult = {
  data?: { user?: AdminUser | null }
  error?: { message: string } | null
}

type MerchantUpsertResult = {
  error?: { message: string } | null
}

type MerchantProvisioningClient = {
  auth: {
    admin: {
      listUsers: (params: { page: number; perPage: number }) => Promise<ListUsersResult>
      inviteUserByEmail: (
        email: string,
        options?: { redirectTo?: string }
      ) => Promise<InviteUserResult>
    }
  }
  from: (table: 'merchants') => {
    upsert: (
      values: MerchantUpsertValues,
      options: { onConflict: string }
    ) => Promise<MerchantUpsertResult>
  }
}

export type ProvisionMerchantForUserInput = {
  userId: string
  email: string
  merchantName?: string
}

export type ProvisionMerchantForUserResult = {
  userId: string
  merchantName: string
}

export type ProvisionMerchantInviteInput = {
  email: string
  merchantName?: string
  redirectTo?: string
}

export type ProvisionMerchantInviteResult = {
  userId: string
  merchantName: string
  invited: boolean
}

export function deriveMerchantNameFromEmail(email: string): string {
  const localPart = email.split('@')[0]?.trim() ?? ''
  const tokens = localPart
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/^\d+|\d+$/g, ''))
    .filter(Boolean)

  if (tokens.length === 0) return 'New Merchant'

  const formatted = tokens
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ')

  return formatted.length > 0 ? `${formatted} Store` : 'New Merchant'
}

async function findUserByEmail(
  client: MerchantProvisioningClient,
  email: string
): Promise<AdminUser | null> {
  const normalizedEmail = email.trim().toLowerCase()
  let page = 1

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`)
    }

    const users = data?.users ?? []
    const match = users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail)
    if (match) return match
    if (users.length < 200) return null
    page += 1
  }
}

async function upsertMerchantRow(
  client: MerchantProvisioningClient,
  values: MerchantUpsertValues
): Promise<void> {
  const { error: merchantError } = await client.from('merchants').upsert(values, {
    onConflict: 'user_id'
  })

  if (merchantError) {
    throw new Error(`Failed to provision merchant row: ${merchantError.message}`)
  }
}

export async function provisionMerchantForUser(
  client: MerchantProvisioningClient,
  input: ProvisionMerchantForUserInput
): Promise<ProvisionMerchantForUserResult> {
  const email = input.email.trim().toLowerCase()
  if (!email) throw new Error('Email is required')

  const merchantName = input.merchantName?.trim() || deriveMerchantNameFromEmail(email)

  await upsertMerchantRow(client, {
    user_id: input.userId,
    merchant_name: merchantName,
    finix_merchant_id: null
  })

  return {
    userId: input.userId,
    merchantName
  }
}

export async function provisionMerchantInvite(
  client: MerchantProvisioningClient,
  input: ProvisionMerchantInviteInput
): Promise<ProvisionMerchantInviteResult> {
  const email = input.email.trim().toLowerCase()
  if (!email) throw new Error('Email is required')

  const merchantName = input.merchantName?.trim() || deriveMerchantNameFromEmail(email)

  let user = await findUserByEmail(client, email)
  let invited = false

  if (!user) {
    const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
      redirectTo: input.redirectTo
    })
    if (error || !data?.user) {
      throw new Error(error?.message ?? 'Failed to invite merchant user')
    }
    user = data.user
    invited = true
  }

  await upsertMerchantRow(client, {
    user_id: user.id,
    merchant_name: merchantName,
    finix_merchant_id: null
  })

  return {
    userId: user.id,
    merchantName,
    invited
  }
}
