// T-AIO — v2 성과 수집 (Pinchtab 스크래핑)

import type { Account, PostPerformance, ThreadPost } from './types'
import { readStore, writeStore } from './store'
import {
  ensureServer, ensureProfile, startInstance, stopInstance,
  openTab, evaluate,
} from './pinchtab'
import { ensureLoggedIn } from './threads-bot'

export async function collectPostMetrics(
  account: Account,
  postUrl: string,
  postId: string
): Promise<PostPerformance | null> {
  await ensureServer()
  const profileId = await ensureProfile(account.username)
  const instanceId = await startInstance(profileId)

  try {
    const tabId = await openTab(instanceId, postUrl)
    await ensureLoggedIn(tabId, account)

    await new Promise(resolve => setTimeout(resolve, 3000))

    const metrics = await evaluate(tabId, `
      (() => {
        const text = document.body.innerText || '';
        const nums = (pattern) => {
          const m = text.match(pattern);
          return m ? parseInt(m[1].replace(/,/g, '')) : 0;
        };
        // Threads 포스트 하단 반응 수 추출
        const spans = Array.from(document.querySelectorAll('span'));
        let likes = 0, replies = 0, reposts = 0;
        for (const s of spans) {
          const t = s.textContent?.trim() || '';
          const parent = s.closest('[role=button]');
          if (!parent) continue;
          const num = parseInt(t.replace(/,/g, ''));
          if (isNaN(num)) continue;
          const svg = parent.querySelector('svg');
          const label = svg?.getAttribute('aria-label') || '';
          if (/like|좋아요/i.test(label)) likes = num;
          else if (/repl|답글|comment/i.test(label)) replies = num;
          else if (/repost|리포스트/i.test(label)) reposts = num;
        }
        return { likes, replies, reposts };
      })()
    `) as { likes: number; replies: number; reposts: number } | null

    if (!metrics) return null

    const performance: PostPerformance = {
      postId,
      collectedAt: new Date().toISOString(),
      likes: metrics.likes ?? 0,
      replies: metrics.replies ?? 0,
      reposts: metrics.reposts ?? 0,
    }

    console.log(`[Performance] 수집: ${postId} → likes:${performance.likes} replies:${performance.replies} reposts:${performance.reposts}`)
    return performance
  } catch (err) {
    console.error('[Performance] 수집 실패:', err)
    return null
  } finally {
    await stopInstance(instanceId).catch(() => {})
  }
}

export async function collectAllPublishedMetrics(account: Account): Promise<number> {
  const posts = readStore<ThreadPost[]>('posts', [])
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const targets = posts.filter(
    p => p.account === account.id && p.status === 'published' && p.publishedUrl && p.publishedAt && p.publishedAt >= sevenDaysAgo
  )

  if (targets.length === 0) return 0

  const performances = readStore<PostPerformance[]>('performance', [])
  let collected = 0

  for (const post of targets) {
    const metrics = await collectPostMetrics(account, post.publishedUrl!, post.id)
    if (metrics) {
      performances.push(metrics)
      collected++
    }
    // 스크래핑 간격
    if (targets.indexOf(post) < targets.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  // 30일 이상 된 데이터 정리
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
  const pruned = performances.filter(p => p.collectedAt >= cutoff)
  writeStore('performance', pruned)

  return collected
}
