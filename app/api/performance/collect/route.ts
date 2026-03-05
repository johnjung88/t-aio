import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { performanceCollectBodySchema } from '@/lib/schemas'
import { readStore } from '@/lib/store'
import { collectAllPublishedMetrics, collectPostMetrics } from '@/lib/performance-collector'
import type { Account, ThreadPost } from '@/lib/types'

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = performanceCollectBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const { accountId, postId } = parsed.data
  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find(a => a.id === accountId)
  if (!account) return fail('Account not found', 404, 'NOT_FOUND')

  if (postId) {
    const posts = readStore<ThreadPost[]>('posts', [])
    const post = posts.find(p => p.id === postId)
    if (!post?.publishedUrl) return fail('Post not found or not published', 404, 'NOT_FOUND')

    const metrics = await collectPostMetrics(account, post.publishedUrl, postId)
    return ok({ collected: metrics ? 1 : 0, metrics })
  }

  const collected = await collectAllPublishedMetrics(account)
  return ok({ collected })
}
