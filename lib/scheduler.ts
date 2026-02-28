// T-AIO — Auto Content Scheduler (node-cron based, server singleton)
// Runs per-account at configured times: product select → hook AI → draft AI → queue

import cron, { ScheduledTask } from 'node-cron'
import { readStore, writeStore } from './store'
import { selectProductForAccount } from './product-selector'
import { generateJSON } from './ai'
import { buildHookGenerationPrompt, buildDraftGenerationPrompt } from './prompts'
import type { Account, AffiliateProduct, HookAngle, StrategyConfig, ThreadPost } from './types'

interface JobEntry {
  accountId: string
  task: ScheduledTask
  cronExpr: string
  lastRunAt?: string
  nextRunAt?: string
}

const jobs = new Map<string, JobEntry>()

function timeToKSTCron(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  return `${parseInt(mStr)} ${parseInt(hStr)} * * *`
}

async function runAutoGen(accountId: string) {
  console.log(`[Scheduler] Auto-gen for account: ${accountId}`)
  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find((a) => a.id === accountId)
  if (!account?.autoGenEnabled) return

  const strategy = readStore<StrategyConfig>('strategy', {} as StrategyConfig)
  const product = selectProductForAccount(account)

  // Generate hooks
  const hookPrompt = buildHookGenerationPrompt(product, '오늘의 추천 제품', strategy)
  let hooks: HookAngle[]
  try {
    hooks = await generateJSON<HookAngle[]>(hookPrompt)
  } catch (err) {
    console.error('[Scheduler] Hook gen failed:', err)
    return
  }

  // Pick strongest hook
  const best = hooks.reduce((a, b) => (a.strength >= b.strength ? a : b))

  // Generate draft
  const draftPrompt = buildDraftGenerationPrompt(product, '오늘의 추천 제품', best.angle, strategy.replyCount ?? 3, strategy)
  let draft: { main: string; reply1?: string; reply2?: string; reply3?: string }
  try {
    draft = await generateJSON(draftPrompt)
  } catch (err) {
    console.error('[Scheduler] Draft gen failed:', err)
    return
  }

  // Save post to queue
  const posts = readStore<ThreadPost[]>('posts', [])
  const newPost: ThreadPost = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'draft',
    contentType: product ? 'affiliate' : 'informational',
    topic: product?.name ?? '오늘의 추천',
    keywords: product?.hookKeywords ?? [],
    account: accountId,
    thread: draft,
    affiliateProductId: product?.id,
    hookAngles: hooks,
    selectedHook: best.angle,
    notes: '[자동생성]',
  }
  posts.push(newPost)
  writeStore('posts', posts)

  // Update product use count
  if (product) {
    const products = readStore<AffiliateProduct[]>('affiliates', [])
    const idx = products.findIndex((p) => p.id === product.id)
    if (idx !== -1) {
      products[idx].useCount = (products[idx].useCount ?? 0) + 1
      products[idx].lastUsedAt = new Date().toISOString()
      writeStore('affiliates', products)
    }
  }

  // Update job lastRunAt
  const job = jobs.get(accountId)
  if (job) job.lastRunAt = new Date().toISOString()

  console.log(`[Scheduler] Auto-gen complete for ${accountId}: post ${newPost.id}`)
}

export function startJob(accountId: string, time: string) {
  stopJob(accountId)
  const cronExpr = timeToKSTCron(time)
  const task = cron.schedule(cronExpr, () => runAutoGen(accountId), { timezone: 'Asia/Seoul' })
  jobs.set(accountId, { accountId, task, cronExpr })
  console.log(`[Scheduler] Started job for ${accountId} at ${time} (${cronExpr})`)
}

export function stopJob(accountId: string) {
  const existing = jobs.get(accountId)
  if (existing) {
    existing.task.stop()
    jobs.delete(accountId)
  }
}

export function stopAll() {
  for (const id of Array.from(jobs.keys())) stopJob(id)
}

export function getStatus() {
  return {
    running: jobs.size > 0,
    jobs: Array.from(jobs.values()).map(({ accountId, cronExpr, lastRunAt }) => ({
      accountId,
      cronExpression: cronExpr,
      lastRunAt,
    })),
  }
}

export function syncWithAccounts() {
  const accounts = readStore<Account[]>('accounts', [])
  for (const account of accounts) {
    if (account.autoGenEnabled) {
      startJob(account.id, account.autoGenTime)
    } else {
      stopJob(account.id)
    }
  }
}
