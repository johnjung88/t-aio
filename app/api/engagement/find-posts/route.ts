import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { engagementFindPostsBodySchema } from '@/lib/schemas'
import { readStore } from '@/lib/store'
import { findPostsByKeyword } from '@/lib/engagement-bot'
import type { Account } from '@/lib/types'

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = engagementFindPostsBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const { accountId, keyword, limit } = parsed.data
  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find(a => a.id === accountId)
  if (!account) return fail('Account not found', 404, 'NOT_FOUND')

  try {
    const posts = await findPostsByKeyword(account, keyword, limit)
    return ok({ keyword, posts })
  } catch (error) {
    console.error('[engagement/find-posts] 검색 실패:', error)
    return fail('검색 실패', 500, 'SEARCH_FAILED')
  }
}
