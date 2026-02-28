// T-AIO — Auto Product Selector
// Prioritizes unused products, rotates categories, applies season weights

import type { AffiliateProduct, Account } from './types'
import { readStore } from './store'

export function selectProductForAccount(account: Account): AffiliateProduct | null {
  const products = readStore<AffiliateProduct[]>('affiliates', [])
  if (products.length === 0) return null

  // Filter by account's preferred categories (if set)
  const candidates =
    account.categories.length > 0
      ? products.filter((p) => account.categories.includes(p.category))
      : products

  const pool = candidates.length > 0 ? candidates : products

  // Sort: unused first, then by last used date (oldest first)
  const sorted = [...pool].sort((a, b) => {
    if (a.useCount !== b.useCount) return a.useCount - b.useCount
    if (!a.lastUsedAt && !b.lastUsedAt) return 0
    if (!a.lastUsedAt) return -1
    if (!b.lastUsedAt) return 1
    return new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime()
  })

  return sorted[0] ?? null
}
