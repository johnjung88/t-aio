import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { normalizePosts } from '@/lib/entities'
import { generateHookBodySchema, type GenerateHookInput } from '@/lib/schemas'
import { generateJSON } from '@/lib/ai'
import { buildHookGenerationPrompt } from '@/lib/prompts'
import { readStore, writeStore } from '@/lib/store'
import { getStrategy } from '@/lib/strategy-store'
import type { AffiliateProduct, HookAngle, ThreadPost } from '@/lib/types'

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = generateHookBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const { postId } = parsed.data as GenerateHookInput
  const posts = normalizePosts(readStore<ThreadPost[]>('posts', []))
  const post = posts.find((item) => item.id === postId)
  if (!post) return fail('Post not found', 404, 'NOT_FOUND')

  const strategy = getStrategy(post.account)
  let product: AffiliateProduct | null = null
  if (post.affiliateProductId) {
    product = readStore<AffiliateProduct[]>('affiliates', []).find((item) => item.id === post.affiliateProductId) ?? null
  }

  try {
    const hooks = await generateJSON<HookAngle[]>(buildHookGenerationPrompt(product, post.topic, strategy))
    const now = new Date().toISOString()

    writeStore(
      'posts',
      posts.map((item) => (item.id === postId ? { ...item, hookAngles: hooks, status: 'hooks_ready', updatedAt: now } : item))
    )

    return ok({ hooks })
  } catch (error) {
    console.error('[generate/hooks] AI 생성 실패:', error)
    return fail('AI 생성 실패. API 키를 확인하세요.', 500, 'AI_GENERATION_FAILED')
  }
}
