import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { normalizeAccounts } from '@/lib/entities'
import { accountCreateBodySchema, type AccountCreateInput } from '@/lib/schemas'
import { readStore, writeStore } from '@/lib/store'
import type { Account } from '@/lib/types'

export async function GET() {
  const accounts = normalizeAccounts(readStore<Account[]>('accounts', []))
  return ok(accounts)
}

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = accountCreateBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const body = parsed.data as AccountCreateInput
  const now = new Date().toISOString()
  const accounts = normalizeAccounts(readStore<Account[]>('accounts', []))

  const newAccount: Account = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    username: body.username,
    displayName: body.displayName ?? body.username,
    niche: body.niche ?? '일반',
    timezone: body.timezone ?? 'Asia/Seoul',
    dailyPostTarget: body.dailyPostTarget ?? 3,
    autoGenEnabled: false,
    autoGenTime: body.autoGenTime ?? '08:00',
    categories: body.categories ?? [],
    todayPostCount: 0,
    todayPostDate: '',
    loginMethod: body.loginMethod ?? 'direct',
    loginEmail: body.loginEmail,
    loginPassword: body.loginPassword,
  }

  accounts.push(newAccount)
  writeStore('accounts', accounts)
  return ok(newAccount, 201)
}
