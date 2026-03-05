// T-AIO — v2 경쟁자 분석 (Pinchtab 스크래핑)

import type { Account, Competitor, CompetitorPost } from './types'
import { readStore, writeStore } from './store'
import {
  ensureServer, ensureProfile, startInstance, stopInstance,
  openTab, evaluate,
} from './pinchtab'
import { ensureLoggedIn } from './threads-bot'

export async function scrapeCompetitorPosts(
  account: Account,
  competitor: Competitor,
  limit = 10
): Promise<CompetitorPost[]> {
  if (!account.loginEmail) return []

  await ensureServer()
  const profileId = await ensureProfile(account.username)
  const instanceId = await startInstance(profileId)

  try {
    const tabId = await openTab(instanceId, `https://www.threads.net/@${competitor.username}`)
    await ensureLoggedIn(tabId, account)

    await new Promise(resolve => setTimeout(resolve, 3000))

    const posts = await evaluate(tabId, `
      (() => {
        const results = [];
        const links = document.querySelectorAll('a[href*="/post/"]');
        const seen = new Set();
        for (const link of links) {
          const href = link.href;
          if (seen.has(href)) continue;
          seen.add(href);
          const container = link.closest('[data-pressable-container]') || link.parentElement?.parentElement;
          const text = container?.textContent?.trim()?.slice(0, 300) || '';
          // 반응 수 추출 시도
          const spans = container?.querySelectorAll('span') || [];
          let likes = 0, replies = 0, reposts = 0;
          for (const s of spans) {
            const num = parseInt(s.textContent?.replace(/,/g, '') || '');
            if (!isNaN(num) && num > 0 && num < 1000000) {
              if (!likes) likes = num;
              else if (!replies) replies = num;
              else if (!reposts) reposts = num;
            }
          }
          results.push({ url: href, text, likes, replies, reposts });
          if (results.length >= ${limit}) break;
        }
        return results;
      })()
    `) as { url: string; text: string; likes: number; replies: number; reposts: number }[] | null

    if (!posts) return []

    const now = new Date().toISOString()
    return posts.map(p => ({
      id: crypto.randomUUID(),
      competitorId: competitor.id,
      collectedAt: now,
      url: p.url,
      text: p.text,
      likes: p.likes ?? 0,
      replies: p.replies ?? 0,
      reposts: p.reposts ?? 0,
    }))
  } catch (err) {
    console.error('[Competitor] 스크래핑 실패:', err)
    return []
  } finally {
    await stopInstance(instanceId).catch(() => {})
  }
}

export async function scrapeAndSave(account: Account, competitor: Competitor): Promise<number> {
  const posts = await scrapeCompetitorPosts(account, competitor)
  if (posts.length === 0) return 0

  const existing = readStore<CompetitorPost[]>('competitor-posts', [])
  existing.push(...posts)

  // 30일 이상 된 데이터 정리
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
  const pruned = existing.filter(p => p.collectedAt >= cutoff)
  writeStore('competitor-posts', pruned)

  // 경쟁자 lastScrapedAt 업데이트
  const competitors = readStore<Competitor[]>('competitors', [])
  const idx = competitors.findIndex(c => c.id === competitor.id)
  if (idx !== -1) {
    competitors[idx].lastScrapedAt = new Date().toISOString()
    competitors[idx].updatedAt = new Date().toISOString()
    writeStore('competitors', competitors)
  }

  return posts.length
}
