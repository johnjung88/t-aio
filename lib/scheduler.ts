// T-AIO — Auto Content Scheduler
// ★ CCG 인사이트 반영:
//   - 댓글 자동추가 랜덤 딜레이 (20~90초) — 봇 탐지 회피
//   - Rate limit 추적 (250 포스트/24h per account)

import cron, { ScheduledTask } from 'node-cron'
import { readStore, writeStore } from './store'
import { selectProductForAccount } from './product-selector'
import { generateJSON } from './ai'
import { buildHookGenerationPrompt, buildDraftGenerationPrompt } from './prompts'
import { publishPost } from './threads-bot'
import type { Account, AffiliateProduct, HookAngle, StrategyConfig, ThreadPost } from './types'

interface JobEntry {
  accountId: string
  task: ScheduledTask
  cronExpr: string
  lastRunAt?: string
}

const jobs = new Map<string, JobEntry>()

const DEFAULT_STRATEGY: StrategyConfig = {
  systemPromptBase: '',
  hookFormulas: [],
  optimalPostLength: 150,
  hashtagStrategy: '본글 마지막 1개',
  bestPostTimes: ['07:30', '20:00'],
  replyCount: 3,
  commentDelayMin: 20,
  commentDelayMax: 90,
}

// 랜덤 딜레이 생성 (봇 탐지 회피)
function randomDelay(minSec: number, maxSec: number): number {
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

// 댓글 자동 추가 (랜덤 딜레이 후 실행)
// 실제 Threads API 연동 전까지는 posts.json에 commentScheduledAt/commentPostedAt만 기록
async function scheduleCommentPost(postId: string, delayMs: number) {
  await new Promise((resolve) => setTimeout(resolve, delayMs))

  const posts = readStore<ThreadPost[]>('posts', [])
  const idx = posts.findIndex((p) => p.id === postId)
  if (idx === -1) return

  // TODO: 실제 Threads API 댓글 발행 연동 시 여기에 구현
  // await threadsApi.createReply(post.publishedUrl, post.thread.reply3)

  posts[idx].commentPostedAt = new Date().toISOString()
  posts[idx].updatedAt = new Date().toISOString()
  writeStore('posts', posts)
  console.log(`[Scheduler] 댓글 게시 완료: post ${postId} (딜레이 ${Math.round(delayMs / 1000)}초)`)
}

async function runAutoGen(accountId: string) {
  console.log(`[Scheduler] 자동생성 시작: ${accountId}`)
  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find((a) => a.id === accountId)
  if (!account?.autoGenEnabled) return

  const strategy = readStore<StrategyConfig>('strategy', DEFAULT_STRATEGY)
  const product = selectProductForAccount(account)

  // 후킹 생성
  const hookPrompt = buildHookGenerationPrompt(product, '오늘의 추천 제품', strategy)
  let hooks: HookAngle[]
  try {
    hooks = await generateJSON<HookAngle[]>(hookPrompt)
  } catch (err) {
    console.error('[Scheduler] 후킹 생성 실패:', err)
    return
  }

  const best = hooks.reduce((a, b) => (a.strength >= b.strength ? a : b))

  // 대본 생성
  const draftPrompt = buildDraftGenerationPrompt(
    product, '오늘의 추천 제품', best.angle, strategy.replyCount ?? 3, strategy
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
  const posts = readStore<ThreadPost[]>('posts', [])
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
    commentScheduledAt,
    notes: '[자동생성]',
  }
  posts.push(newPost)
  writeStore('posts', posts)

  // Threads 발행
  const publishedUrl = await publishPost(newPost)
  if (publishedUrl) {
    const postIdx = posts.findIndex(p => p.id === newPost.id)
    if (postIdx !== -1) {
      posts[postIdx].status = 'published'
      posts[postIdx].publishedAt = new Date().toISOString()
      posts[postIdx].publishedUrl = publishedUrl
      posts[postIdx].updatedAt = new Date().toISOString()
      writeStore('posts', posts)
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
  jobs.set(accountId, { accountId, task, cronExpr })
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
    jobs: Array.from(jobs.values()).map(({ accountId, cronExpr, lastRunAt }) => ({
      accountId, cronExpression: cronExpr, lastRunAt,
    })),
  }
}

export function syncWithAccounts() {
  const accounts = readStore<Account[]>('accounts', [])
  for (const account of accounts) {
    if (account.autoGenEnabled) startJob(account.id, account.autoGenTime)
    else stopJob(account.id)
  }
}
