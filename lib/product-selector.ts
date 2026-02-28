import type { AffiliateProduct, Account } from './types'
import { readStore } from './store'

export function selectProductForAccount(account: Account): AffiliateProduct | null {
  const products = readStore<AffiliateProduct[]>('affiliates', [])
  if (products.length === 0) return null

  const candidates = account.categories.length > 0
    ? products.filter((p) => account.categories.includes(p.category))
    : products

  const pool = candidates.length > 0 ? candidates : products

  return [...pool].sort((a, b) => {
    if (a.useCount !== b.useCount) return a.useCount - b.useCount
    if (!a.lastUsedAt && !b.lastUsedAt) return 0
    if (!a.lastUsedAt) return -1
    if (!b.lastUsedAt) return 1
    return new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime()
  })[0] ?? null
}
