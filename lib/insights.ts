import fs from 'fs'
import path from 'path'
import { readStore, writeStore } from './store'
import type { ThreadPost, ContentFormat, HookType } from './types'

export interface StrategyInsights {
  accountId: string
  computedAt: string
  dataPoints: number
  topHookTypes: { type: HookType; avgScore: number; count: number }[]
  topContentFormats: { format: ContentFormat; avgScore: number; count: number }[]
  topPosts: { score: number; text: string; hookType?: HookType; format?: ContentFormat }[]
}

// score = likes×2 + replies×3 + reposts×4
function calcScore(perf: { likes: number; replies: number; reposts: number }): number {
  return (perf.likes ?? 0) * 2 + (perf.replies ?? 0) * 3 + (perf.reposts ?? 0) * 4
}

export function computeInsights(accountId: string): void {
  const posts = readStore<ThreadPost[]>('posts', [])
  const published = posts.filter(
    p => p.account === accountId && p.status === 'published' && p.performanceHistory?.length
  )

  if (published.length < 5) return

  const scored = published.map(p => {
    const latest = p.performanceHistory![p.performanceHistory!.length - 1]
    const score = calcScore(latest)
    const hookType = p.hookAngles?.find(h => h.angle === p.selectedHook)?.type
    return { post: p, score, hookType }
  }).sort((a, b) => b.score - a.score)

  const hookMap = new Map<string, { total: number; count: number }>()
  for (const { hookType, score } of scored) {
    if (!hookType) continue
    const cur = hookMap.get(hookType) ?? { total: 0, count: 0 }
    hookMap.set(hookType, { total: cur.total + score, count: cur.count + 1 })
  }
  const topHookTypes = Array.from(hookMap.entries())
    .map(([type, { total, count }]) => ({
      type: type as HookType,
      avgScore: Math.round((total / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3)

  const formatMap = new Map<string, { total: number; count: number }>()
  for (const { post, score } of scored) {
    if (!post.contentFormat) continue
    const cur = formatMap.get(post.contentFormat) ?? { total: 0, count: 0 }
    formatMap.set(post.contentFormat, { total: cur.total + score, count: cur.count + 1 })
  }
  const topContentFormats = Array.from(formatMap.entries())
    .map(([format, { total, count }]) => ({
      format: format as ContentFormat,
      avgScore: Math.round((total / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3)

  const topPosts = scored.slice(0, 3).map(({ post, score, hookType }) => ({
    score,
    text: (post.thread?.main ?? '').slice(0, 120),
    hookType: hookType as HookType | undefined,
    format: post.contentFormat,
  }))

  const insights: StrategyInsights = {
    accountId,
    computedAt: new Date().toISOString(),
    dataPoints: published.length,
    topHookTypes,
    topContentFormats,
    topPosts,
  }

  writeStore(`strategy-insights-${accountId}`, insights)
  console.log(`[Insights] 계산 완료: ${accountId} (데이터 ${published.length}개)`)
}

export function loadInsights(accountId: string): StrategyInsights | null {
  try {
    const fp = path.join(process.cwd(), 'data', `strategy-insights-${accountId}.json`)
    if (!fs.existsSync(fp)) return null
    const insights = readStore<StrategyInsights | null>(`strategy-insights-${accountId}`, null)
    if (!insights || insights.dataPoints < 5) return null
    return insights
  } catch {
    return null
  }
}
