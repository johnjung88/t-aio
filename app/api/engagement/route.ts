import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { normalizeEngagements } from '@/lib/entities'
import { engagementCreateBodySchema } from '@/lib/schemas'
import { readStore, writeStore } from '@/lib/store'
import type { EngagementTask } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const accountId = searchParams.get('accountId')
  const status = searchParams.get('status')

  let tasks = normalizeEngagements(readStore<EngagementTask[]>('engagements', []))
  if (accountId) tasks = tasks.filter(t => t.accountId === accountId)
  if (status) tasks = tasks.filter(t => t.status === status)

  return ok(tasks)
}

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = engagementCreateBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const { accountId, action, targetUrl, targetUsername, commentText } = parsed.data
  const now = new Date().toISOString()

  const task: EngagementTask = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    accountId,
    action,
    targetUrl,
    targetUsername,
    commentText,
    status: 'pending',
  }

  const tasks = readStore<EngagementTask[]>('engagements', [])
  tasks.push(task)
  writeStore('engagements', tasks)

  return ok(task, 201)
}
