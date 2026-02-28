import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { normalizeAccounts } from '@/lib/entities'
import { removeUndefined } from '@/lib/object'
import { accountPatchBodySchema } from '@/lib/schemas'
import { readStore, writeStore } from '@/lib/store'
import type { Account } from '@/lib/types'

interface Context {
  params: { id: string }
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const rawBody: unknown = await req.json()
  const parsed = accountPatchBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const accounts = normalizeAccounts(readStore<Account[]>('accounts', []))
  const index = accounts.findIndex((item) => item.id === params.id)
  if (index === -1) return fail('Account not found', 404, 'NOT_FOUND')

  const updates = removeUndefined(parsed.data as Record<string, unknown>)

  accounts[index] = {
    ...accounts[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  writeStore('accounts', accounts)
  return ok(accounts[index])
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const accounts = normalizeAccounts(readStore<Account[]>('accounts', []))
  const exists = accounts.some((item) => item.id === params.id)
  if (!exists) return fail('Account not found', 404, 'NOT_FOUND')

  writeStore('accounts', accounts.filter((item) => item.id !== params.id))
  return ok({ id: params.id, deleted: true })
}
