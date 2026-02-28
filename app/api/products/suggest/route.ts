import { NextRequest } from 'next/server'
import { fail, ok } from '@/lib/api'
import { normalizeAccounts } from '@/lib/entities'
import { parseProductSuggestQuery } from '@/lib/schemas'
import { readStore, writeStore } from '@/lib/store'
import { selectProductForAccount } from '@/lib/product-selector'
import type { Account } from '@/lib/types'

export async function GET(req: NextRequest) {
  const query = parseProductSuggestQuery({
    accountId: new URL(req.url).searchParams.get('accountId'),
  })

  const accounts = normalizeAccounts(readStore<Account[]>('accounts', []))
  writeStore('accounts', accounts)

  const account = accounts.find((item) => item.id === query.accountId)
  if (!account) return fail('Account not found', 404, 'NOT_FOUND')

  return ok({ product: selectProductForAccount(account) })
}
