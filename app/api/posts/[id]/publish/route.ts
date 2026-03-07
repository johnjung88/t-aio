import { NextRequest } from 'next/server'
import { fail, ok } from '@/lib/api'
import { readStore, writeStore } from '@/lib/store'
import { randomDelay } from '@/lib/scheduler'
import { publishPost, publishReply } from '@/lib/threads-bot'
import type { StrategyConfig, ThreadPost } from '@/lib/types'

// 브라우저 자동화 + 댓글 딜레이로 최대 5분 소요 가능
export const maxDuration = 300

interface Context {
  params: { id: string }
}

export async function POST(_req: NextRequest, { params }: Context) {
  const posts = readStore<ThreadPost[]>('posts', [])
  const post = posts.find((p) => p.id === params.id)
  if (!post) return fail('Post not found', 404, 'NOT_FOUND')

  if (post.status !== 'draft' && post.status !== 'scheduled') {
    return fail(
      `발행 불가: 현재 상태는 '${post.status}' (draft 또는 scheduled만 자동 발행 가능)`,
      400,
      'INVALID_STATUS'
    )
  }

  // ── 본글 발행 ────────────────────────────────────────────────────────────────
  let publishedUrl: string | null = null
  try {
    publishedUrl = await publishPost(post)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return fail(
      `본글 발행 실패 (Pinchtab 서버가 실행 중인지 확인하세요): ${msg}`,
      500,
      'PUBLISH_ERROR'
    )
  }

  if (!publishedUrl) {
    return fail(
      '본글 발행 실패 — publishedUrl을 받지 못했습니다. Pinchtab 서버 상태를 확인하세요.',
      500,
      'PUBLISH_FAILED'
    )
  }

  // 본글 발행 성공 즉시 저장 (이후 댓글 실패해도 URL은 보존)
  const postsAfterMain = readStore<ThreadPost[]>('posts', [])
  const mainIdx = postsAfterMain.findIndex((p) => p.id === params.id)
  if (mainIdx !== -1) {
    postsAfterMain[mainIdx] = {
      ...postsAfterMain[mainIdx],
      publishedUrl,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    writeStore('posts', postsAfterMain)
  }

  // ── 댓글 순차 발행 (랜덤 딜레이 포함) ──────────────────────────────────────
  const strategy = readStore<StrategyConfig>('strategy', {} as StrategyConfig)
  const postWithUrl: ThreadPost = { ...post, publishedUrl }
  const replies = [post.thread.reply1, post.thread.reply2, post.thread.reply3].filter(
    Boolean
  ) as string[]

  let repliesPublished = 0
  for (let i = 0; i < replies.length; i++) {
    // 첫 댓글 전에도 약간의 딜레이 (자연스러운 간격)
    const delayMs = randomDelay(
      strategy.commentDelayMin ?? 20,
      strategy.commentDelayMax ?? 90
    )
    await new Promise((resolve) => setTimeout(resolve, delayMs))

    const ok2 = await publishReply(postWithUrl, replies[i])
    if (ok2) repliesPublished++
  }

  // ── 최종 status 업데이트 ─────────────────────────────────────────────────────
  const finalPosts = readStore<ThreadPost[]>('posts', [])
  const finalIdx = finalPosts.findIndex((p) => p.id === params.id)
  if (finalIdx !== -1) {
    finalPosts[finalIdx] = {
      ...finalPosts[finalIdx],
      status: 'published',
      updatedAt: new Date().toISOString(),
    }
    writeStore('posts', finalPosts)
    return ok({
      post: finalPosts[finalIdx],
      publishedUrl,
      repliesPublished,
      repliesTotal: replies.length,
    })
  }

  return ok({ post: postWithUrl, publishedUrl, repliesPublished, repliesTotal: replies.length })
}
