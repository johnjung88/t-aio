import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { normalizeAccounts } from '@/lib/entities'
import { schedulerBodySchema, type SchedulerActionInput } from '@/lib/schemas'
import { getStatus, startJob, stopJob } from '@/lib/scheduler'
import { readStore, writeStore } from '@/lib/store'
import type { Account } from '@/lib/types'

export async function GET() {
  const accounts = normalizeAccounts(readStore<Account[]>('accounts', []))
  writeStore('accounts', accounts)

  const status = getStatus()
  const runningIds = new Set(status.jobs.map((job) => job.accountId))
  const jobs = accounts.map((account) => ({
    accountId: account.id,
    username: account.username,
    autoGenEnabled: account.autoGenEnabled,
    autoGenTime: account.autoGenTime,
    running: runningIds.has(account.id),
    todayPostCount: account.todayPostCount,
    todayPostDate: account.todayPostDate,
  }))

  return ok({ jobs })
}

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = schedulerBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const { action, accountId, time } = parsed.data as SchedulerActionInput
  if (action === 'start') {
    const accounts = normalizeAccounts(readStore<Account[]>('accounts', []))
    const account = accounts.find((item) => item.id === accountId)
    startJob(accountId, time ?? account?.autoGenTime ?? '08:00')
    return ok({ action: 'started', accountId })
  }

  if (action === 'stop') {
    stopJob(accountId)
    return ok({ action: 'stopped', accountId })
  }

  return fail('Invalid action', 400, 'INVALID_ACTION')
}
