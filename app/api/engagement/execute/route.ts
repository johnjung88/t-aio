import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { engagementExecuteBodySchema } from '@/lib/schemas'
import { readStore, writeStore } from '@/lib/store'
import { commentOnPost, likePost, followUser } from '@/lib/engagement-bot'
import type { Account, EngagementTask } from '@/lib/types'

function randomDelay(minSec: number, maxSec: number): number {
  return Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000
}

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = engagementExecuteBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const { accountId, limit = 10 } = parsed.data
  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find(a => a.id === accountId)
  if (!account) return fail('Account not found', 404, 'NOT_FOUND')

  const tasks = readStore<EngagementTask[]>('engagements', [])
  const pending = tasks.filter(t => t.accountId === accountId && t.status === 'pending').slice(0, limit)

  if (pending.length === 0) return ok({ executed: 0, message: '실행할 대기 태스크 없음' })

  const results: { id: string; success: boolean; error?: string }[] = []

  for (const task of pending) {
    let result: { success: boolean; error?: string }

    switch (task.action) {
      case 'comment':
        result = await commentOnPost(account, task.targetUrl, task.commentText ?? '')
        break
      case 'like':
        result = await likePost(account, task.targetUrl)
        break
      case 'follow':
        result = await followUser(account, task.targetUsername ?? '')
        break
      default:
        result = { success: false, error: `Unknown action: ${task.action}` }
    }

    const now = new Date().toISOString()
    const idx = tasks.findIndex(t => t.id === task.id)
    if (idx !== -1) {
      tasks[idx].status = result.success ? 'completed' : 'failed'
      tasks[idx].executedAt = now
      tasks[idx].updatedAt = now
      if (result.error) tasks[idx].error = result.error
    }

    results.push({ id: task.id, ...result })

    // 봇 탐지 회피: 액션 간 랜덤 딜레이 (2~5분)
    if (pending.indexOf(task) < pending.length - 1) {
      await new Promise(resolve => setTimeout(resolve, randomDelay(120, 300)))
    }
  }

  writeStore('engagements', tasks)
  return ok({ executed: results.length, results })
}
