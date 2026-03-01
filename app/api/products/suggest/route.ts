import { NextRequest } from 'next/server'
import { ok } from '@/lib/api'
import { normalizeAccounts, normalizeProducts } from '@/lib/entities'
import { readStore, writeStore } from '@/lib/store'
import { selectProductForAccount } from '@/lib/product-selector'
import type { Account, AffiliateProduct } from '@/lib/types'

export async function GET(req: NextRequest) {
  const accountId = new URL(req.url).searchParams.get('accountId')

  const accounts = normalizeAccounts(readStore<Account[]>('accounts', []))
  writeStore('accounts', accounts)

  // accountId 없거나 해당 계정을 못 찾으면 — 전체 상품 중 미사용 우선 추천
  const account = accountId ? accounts.find((item) => item.id === accountId) : null
  if (!account) {
    const products = normalizeProducts(readStore<AffiliateProduct[]>('affiliates', []))
    const best = [...products].sort((a, b) => (a.useCount ?? 0) - (b.useCount ?? 0))[0] ?? null
    return ok({ product: best })
  }

  return ok({ product: selectProductForAccount(account) })
}
