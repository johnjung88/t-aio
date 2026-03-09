import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { normalizePosts } from '@/lib/entities'
import { generateDraftBodySchema, type GenerateDraftInput } from '@/lib/schemas'
import { generateJSON } from '@/lib/ai'
import { buildDraftGenerationPrompt } from '@/lib/prompts'
import { readStore, writeStore } from '@/lib/store'
import { getStrategy } from '@/lib/strategy-store'
import { loadInsights } from '@/lib/insights'
import type { AffiliateProduct, ThreadPost } from '@/lib/types'

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = generateDraftBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const { postId, replyCount } = parsed.data as GenerateDraftInput
  const posts = normalizePosts(readStore<ThreadPost[]>('posts', []))
  const post = posts.find((item) => item.id === postId)

  if (!post) return fail('Post not found', 404, 'NOT_FOUND')
  if (!post.selectedHook) return fail('No hook selected', 400, 'INVALID_POST_STATE')

  const strategy = getStrategy(post.account)
  let product: AffiliateProduct | null = null
  if (post.affiliateProductId) {
    product = readStore<AffiliateProduct[]>('affiliates', []).find((item) => item.id === post.affiliateProductId) ?? null
  }
  const insights = loadInsights(post.account)

  const count = replyCount ?? strategy.replyCount ?? 3
  try {
    const draft = await generateJSON<{ main: string; reply1?: string; reply2?: string; reply3?: string }>(
      buildDraftGenerationPrompt(product, post.topic, post.selectedHook, count, strategy, post.contentFormat, insights)
    )

    const now = new Date().toISOString()
    writeStore(
      'posts',
      posts.map((item) => (item.id === postId ? { ...item, thread: draft, status: 'draft', updatedAt: now } : item))
    )

    return ok({ draft })
  } catch (error) {
    console.error('[generate/draft] AI 생성 실패:', error)
    return fail('AI 생성 실패. API 키를 확인하세요.', 500, 'AI_GENERATION_FAILED')
  }
}
