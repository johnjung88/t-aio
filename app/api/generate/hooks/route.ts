import { NextRequest, NextResponse } from 'next/server'
import { readStore } from '@/lib/store'
import { generateJSON } from '@/lib/ai'
import { buildHookGenerationPrompt } from '@/lib/prompts'
import type { AffiliateProduct, HookAngle, StrategyConfig, ThreadPost } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { postId } = await req.json()

  const posts = readStore<ThreadPost[]>('posts', [])
  const post = posts.find((p) => p.id === postId)
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const strategy = readStore<StrategyConfig>('strategy', {} as StrategyConfig)

  let product: AffiliateProduct | null = null
  if (post.affiliateProductId) {
    const products = readStore<AffiliateProduct[]>('affiliates', [])
    product = products.find((p) => p.id === post.affiliateProductId) ?? null
  }

  const prompt = buildHookGenerationPrompt(product, post.topic, strategy)
  const hooks = await generateJSON<HookAngle[]>(prompt)

  // Save hooks to post
  const updatedPosts = posts.map((p) =>
    p.id === postId ? { ...p, hookAngles: hooks, status: 'hooks_ready' as const } : p
  )
  const { writeStore } = await import('@/lib/store')
  writeStore('posts', updatedPosts)

  return NextResponse.json({ hooks })
}
