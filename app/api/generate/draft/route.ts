import { NextRequest, NextResponse } from 'next/server'
import { readStore, writeStore } from '@/lib/store'
import { generateJSON } from '@/lib/ai'
import { buildDraftGenerationPrompt } from '@/lib/prompts'
import type { AffiliateProduct, StrategyConfig, ThreadPost } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { postId, replyCount } = await req.json()

  const posts = readStore<ThreadPost[]>('posts', [])
  const post = posts.find((p) => p.id === postId)
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (!post.selectedHook) return NextResponse.json({ error: 'No hook selected' }, { status: 400 })

  const strategy = readStore<StrategyConfig>('strategy', {} as StrategyConfig)

  let product: AffiliateProduct | null = null
  if (post.affiliateProductId) {
    const products = readStore<AffiliateProduct[]>('affiliates', [])
    product = products.find((p) => p.id === post.affiliateProductId) ?? null
  }

  const count = replyCount ?? strategy.replyCount ?? 3
  const prompt = buildDraftGenerationPrompt(product, post.topic, post.selectedHook, count, strategy)
  const draft = await generateJSON<{ main: string; reply1?: string; reply2?: string; reply3?: string }>(prompt)

  // Save draft
  const updatedPosts = posts.map((p) =>
    p.id === postId ? { ...p, thread: draft, status: 'draft' as const } : p
  )
  writeStore('posts', updatedPosts)

  return NextResponse.json({ draft })
}
