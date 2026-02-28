import type { Account, AffiliateProduct, ThreadPost } from '@/lib/types'

function nowIso() {
  return new Date().toISOString()
}

export function withPostTimestamps(post: ThreadPost): ThreadPost {
  const now = nowIso()
  const createdAt = post.createdAt || post.updatedAt || now
  const updatedAt = post.updatedAt || createdAt
  return { ...post, createdAt, updatedAt }
}

export function withProductTimestamps(product: AffiliateProduct): AffiliateProduct {
  const now = nowIso()
  const createdAt = product.createdAt || product.updatedAt || now
  const updatedAt = product.updatedAt || createdAt
  return { ...product, createdAt, updatedAt }
}

export function withAccountTimestamps(account: Account): Account {
  const now = nowIso()
  const createdAt = account.createdAt || account.updatedAt || now
  const updatedAt = account.updatedAt || createdAt
  return { ...account, createdAt, updatedAt }
}

export function normalizePosts(posts: ThreadPost[]) {
  return posts.map(withPostTimestamps)
}

export function normalizeProducts(products: AffiliateProduct[]) {
  return products.map(withProductTimestamps)
}

export function normalizeAccounts(accounts: Account[]) {
  return accounts.map(withAccountTimestamps)
}
