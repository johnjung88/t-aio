// T-AIO — Auto Content Scheduler
// ★ CCG 인사이트 반영:
//   - 댓글 자동추가 랜덤 딜레이 (20~90초) — 봇 탐지 회피
//   - Rate limit 추적 (250 포스트/24h per account)

import cron, { ScheduledTask } from 'node-cron'
import { readStore, writeStore } from './store'
import { getStrategy } from './strategy-store'
import { computeInsights, loadInsights } from './insights'
import { selectProductForAccount } from './product-selector'
import { generateJSON } from './ai'
import { buildHookGenerationPrompt, buildDraftGenerationPrompt } from './prompts'
import { publishPost, publishReply } from './threads-bot'
import type { Account, AffiliateProduct, ContentFormat, HookAngle, StrategyConfig, ThreadPost, EngagementTask } from './types'

interface JobEntry {
  accountId: string
  task: ScheduledTask
  cronExpr: string
  type: 'autogen' | 'engagement' | 'performance'
  lastRunAt?: string
}

const jobs = new Map<string, JobEntry>()

// ── 요일별 포스트 목표 수 (스마트 스케줄링) ──
// weekdayPostCounts: [월,화,수,목,금,토,일]
function getDailyPostTarget(strategy: StrategyConfig, account: Account): number {
  const jsDay = new Date().getDay() // 0=Sun, 1=Mon, ...
  const mapped = [6, 0, 1, 2, 3, 4, 5] // JS day → weekdayPostCounts index
  const idx = mapped[jsDay]
  if (strategy.weekdayPostCounts && strategy.weekdayPostCounts[idx] != null) {
    return strategy.weekdayPostCounts[idx]
  }
  return account.dailyPostTarget ?? 1
}

// ── 콘텐츠 포맷 가중치 기반 랜덤 선택 ──
function pickContentFormat(strategy: StrategyConfig): ContentFormat | undefined {
  const weights = strategy.contentFormatWeights
  if (!weights) return undefined
  const entries = Object.entries(weights) as [ContentFormat, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  if (total <= 0) return undefined
  let rand = Math.random() * total
  for (const [fmt, w] of entries) {
    rand -= w
    if (rand <= 0) return fmt
  }
  return entries[0]?.[0]
}


// 랜덤 딜레이 생성 (봇 탐지 회피)
export function randomDelay(minSec: number, maxSec: number): number {
  return Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000
}

// Rate limit 체크 및 카운터 업데이트
function checkAndIncrementRateLimit(account: Account): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10)
  const accounts = readStore<Account[]>('accounts', [])
  const idx = accounts.findIndex((a) => a.id === account.id)
  if (idx === -1) return { allowed: false, remaining: 0 }

  // 날짜가 바뀌면 카운터 리셋
  if (accounts[idx].todayPostDate !== today) {
    accounts[idx].todayPostCount = 0
    accounts[idx].todayPostDate = today
    accounts[idx].updatedAt = new Date().toISOString()
  }

  const DAILY_LIMIT = 250
  const current = accounts[idx].todayPostCount ?? 0
  if (current >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  accounts[idx].todayPostCount = current + 1
  accounts[idx].todayPostDate = today
  accounts[idx].updatedAt = new Date().toISOString()
  writeStore('accounts', accounts)
  return { allowed: true, remaining: DAILY_LIMIT - current - 1 }
}

// 댓글 자동 추가 (랜덤 딜레이 후 reply1~3 순서대로 발행)
async function scheduleCommentPost(postId: string, delayMs: number) {
  await new Promise((resolve) => setTimeout(resolve, delayMs))

  const posts = readStore<ThreadPost[]>('posts', [])
  const idx = posts.findIndex((p) => p.id === postId)
  if (idx === -1) return

  const post = posts[idx]
  const strategy = getStrategy(post.account)
  const replies = [post.thread.reply1, post.thread.reply2, post.thread.reply3].filter(Boolean) as string[]

  for (let i = 0; i < replies.length; i++) {
    await publishReply(post, replies[i])
    // 마지막 댓글이 아니면 다음 댓글 전 랜덤 딜레이
    if (i < replies.length - 1) {
      const interReplyDelay = randomDelay(
        strategy.commentDelayMin ?? 20,
        strategy.commentDelayMax ?? 90
      )
      await new Promise((resolve) => setTimeout(resolve, interReplyDelay))
    }
  }

  const updatedPosts = readStore<ThreadPost[]>('posts', [])
  const updatedIdx = updatedPosts.findIndex((p) => p.id === postId)
  if (updatedIdx !== -1) {
    updatedPosts[updatedIdx].commentPostedAt = new Date().toISOString()
    updatedPosts[updatedIdx].updatedAt = new Date().toISOString()
    writeStore('posts', updatedPosts)
  }
  console.log(`[Scheduler] 댓글 게시 완료: post ${postId} (${replies.length}개, 딜레이 ${Math.round(delayMs / 1000)}초)`)
}

async function runAutoGen(accountId: string) {
  console.log(`[Scheduler] 자동생성 시작: ${accountId}`)
  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find((a) => a.id === accountId)
  if (!account?.autoGenEnabled) return

  const strategy = getStrategy(accountId)

  // 스마트 스케줄링: 오늘 이미 생성한 포스트 수 vs 요일별 목표
  const dailyTarget = getDailyPostTarget(strategy, account)
  const today = new Date().toISOString().slice(0, 10)
  const posts = readStore<ThreadPost[]>('posts', [])
  const todayAutoGenCount = posts.filter(
    p => p.account === accountId && p.notes === '[자동생성]' && p.createdAt?.startsWith(today)
  ).length
  if (todayAutoGenCount >= dailyTarget) {
    console.log(`[Scheduler] 일일 목표 도달: ${accountId} (${todayAutoGenCount}/${dailyTarget})`)
    return
  }

  const product = selectProductForAccount(account)
  const contentFormat = pickContentFormat(strategy)

  const insights = loadInsights(accountId)

  // 후킹 생성
  const hookPrompt = buildHookGenerationPrompt(product, '오늘의 추천 제품', strategy, insights)
  let hooks: HookAngle[]
  try {
    hooks = await generateJSON<HookAngle[]>(hookPrompt)
  } catch (err) {
    console.error('[Scheduler] 후킹 생성 실패:', err)
    return
  }

  const best = hooks.reduce((a, b) => (a.strength >= b.strength ? a : b))

  // 대본 생성 (콘텐츠 포맷 반영)
  const draftPrompt = buildDraftGenerationPrompt(
    product, '오늘의 추천 제품', best.angle, strategy.replyCount ?? 3, strategy, contentFormat, insights
  )
  let draft: { main: string; reply1?: string; reply2?: string; reply3?: string }
  try {
    draft = await generateJSON(draftPrompt)
  } catch (err) {
    console.error('[Scheduler] 대본 생성 실패:', err)
    return
  }

  // Rate limit 체크
  const rateCheck = checkAndIncrementRateLimit(account)
  if (!rateCheck.allowed) {
    console.warn(`[Scheduler] Rate limit 초과: ${accountId} (250/24h)`)
    return
  }

  const now = new Date()
  const delayMs = randomDelay(
    strategy.commentDelayMin ?? 20,
    strategy.commentDelayMax ?? 90
  )
  const commentScheduledAt = new Date(now.getTime() + delayMs).toISOString()

  // 포스트 저장
  const allPosts = readStore<ThreadPost[]>('posts', [])
  const newPost: ThreadPost = {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: 'draft',
    contentType: product ? 'affiliate' : 'informational',
    topic: product?.name ?? '오늘의 추천',
    keywords: product?.hookKeywords ?? [],
    account: accountId,
    thread: draft,
    affiliateProductId: product?.id,
    hookAngles: hooks,
    selectedHook: best.angle,
    contentFormat,
    commentScheduledAt,
    notes: '[자동생성]',
  }
  allPosts.push(newPost)
  writeStore('posts', allPosts)

  // Threads 발행
  const publishedUrl = await publishPost(newPost)
  if (publishedUrl) {
    const postIdx = allPosts.findIndex(p => p.id === newPost.id)
    if (postIdx !== -1) {
      allPosts[postIdx].status = 'published'
      allPosts[postIdx].publishedAt = new Date().toISOString()
      allPosts[postIdx].publishedUrl = publishedUrl
      allPosts[postIdx].updatedAt = new Date().toISOString()
      writeStore('posts', allPosts)
    }
  }

  // 상품 useCount 업데이트
  if (product) {
    const products = readStore<AffiliateProduct[]>('affiliates', [])
    const pidx = products.findIndex((p) => p.id === product.id)
    if (pidx !== -1) {
      products[pidx].useCount = (products[pidx].useCount ?? 0) + 1
      products[pidx].lastUsedAt = now.toISOString()
      products[pidx].updatedAt = now.toISOString()
      writeStore('affiliates', products)
    }
  }

  // 댓글 자동 추가 예약 (비동기 - 블로킹 없음)
  scheduleCommentPost(newPost.id, delayMs).catch((err) =>
    console.error('[Scheduler] 댓글 예약 실패:', err)
  )

  const job = jobs.get(accountId)
  if (job) job.lastRunAt = now.toISOString()

  console.log(
    `[Scheduler] 완료: ${accountId} → post ${newPost.id}, ` +
    `댓글 ${Math.round(delayMs / 1000)}초 후, Rate limit 잔여 ${rateCheck.remaining}`
  )
}

function timeToKSTCron(hhmm: string): string {
  const [h, m] = hhmm.split(':')
  return `${parseInt(m)} ${parseInt(h)} * * *`
}

export function startJob(accountId: string, time: string) {
  stopJob(accountId)
  const cronExpr = timeToKSTCron(time)
  const task = cron.schedule(cronExpr, () => runAutoGen(accountId), { timezone: 'Asia/Seoul' })
  jobs.set(accountId, { accountId, task, cronExpr, type: 'autogen' })
  console.log(`[Scheduler] 등록: ${accountId} @ ${time}`)
}

export function stopJob(accountId: string) {
  const existing = jobs.get(accountId)
  if (existing) { existing.task.stop(); jobs.delete(accountId) }
}

export function stopAll() {
  for (const id of Array.from(jobs.keys())) stopJob(id)
}

export function getStatus() {
  return {
    running: jobs.size > 0,
    jobs: Array.from(jobs.values()).map(({ accountId, cronExpr, type, lastRunAt }) => ({
      accountId, cronExpression: cronExpr, type, lastRunAt,
    })),
  }
}

export function syncWithAccounts() {
  const accounts = readStore<Account[]>('accounts', [])
  for (const account of accounts) {
    if (account.autoGenEnabled && account.autoGenTime) startJob(account.id, account.autoGenTime)
    else stopJob(account.id)
  }
}

// ── 인게이지먼트 자동화 cron ──
// 매일 지정 시간에 대기 중인 engagement 태스크 실행
export function startEngagementJob(accountId: string, time: string) {
  const jobKey = `eng_${accountId}`
  const existing = jobs.get(jobKey)
  if (existing) { existing.task.stop(); jobs.delete(jobKey) }

  const cronExpr = timeToKSTCron(time)
  const task = cron.schedule(cronExpr, () => runEngagementBatch(accountId), { timezone: 'Asia/Seoul' })
  jobs.set(jobKey, { accountId, task, cronExpr, type: 'engagement' })
  console.log(`[Scheduler] 인게이지먼트 등록: ${accountId} @ ${time}`)
}

async function runEngagementBatch(accountId: string) {
  console.log(`[Scheduler] 인게이지먼트 실행: ${accountId}`)
  try {
    // engagement execute API를 내부 호출하는 대신 직접 로직 수행
    const tasks = readStore<EngagementTask[]>('engagements', [])
    const pending = tasks.filter(t => t.accountId === accountId && t.status === 'pending')
    if (pending.length === 0) {
      console.log(`[Scheduler] 대기 인게이지먼트 없음: ${accountId}`)
      return
    }
    // 최대 5개씩 처리 — 실제 실행은 API 경유
    const res = await fetch(`http://localhost:4000/api/engagement/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, limit: 5 }),
    })
    if (res.ok) {
      console.log(`[Scheduler] 인게이지먼트 완료: ${accountId}`)
    }
  } catch (err) {
    console.error('[Scheduler] 인게이지먼트 실패:', err)
  }
}

// ── 성과 수집 cron (6시간마다) ──
export function startPerformanceJob(accountId: string) {
  const jobKey = `perf_${accountId}`
  const existing = jobs.get(jobKey)
  if (existing) { existing.task.stop(); jobs.delete(jobKey) }

  // 6시간마다: 0:00, 6:00, 12:00, 18:00
  const cronExpr = '0 0,6,12,18 * * *'
  const task = cron.schedule(cronExpr, () => runPerformanceCollection(accountId), { timezone: 'Asia/Seoul' })
  jobs.set(jobKey, { accountId, task, cronExpr, type: 'performance' })
  console.log(`[Scheduler] 성과수집 등록: ${accountId} (6시간 주기)`)
}

async function runPerformanceCollection(accountId: string) {
  console.log(`[Scheduler] 성과수집 시작: ${accountId}`)
  try {
    const res = await fetch(`http://localhost:4000/api/performance/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    })
    if (res.ok) {
      console.log(`[Scheduler] 성과수집 완료: ${accountId}`)
      computeInsights(accountId)
    }
  } catch (err) {
    console.error('[Scheduler] 성과수집 실패:', err)
  }
}
