import { NextRequest } from 'next/server'
import { fail, ok } from '@/lib/api'
import { readStore, writeStore } from '@/lib/store'
import type { EngagementTask } from '@/lib/types'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const tasks = readStore<EngagementTask[]>('engagements', [])
  const task = tasks.find(t => t.id === params.id)
  if (!task) return fail('Task not found', 404, 'NOT_FOUND')
  return ok(task)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json() as Partial<EngagementTask>
  const tasks = readStore<EngagementTask[]>('engagements', [])
  const idx = tasks.findIndex(t => t.id === params.id)
  if (idx === -1) return fail('Task not found', 404, 'NOT_FOUND')

  const now = new Date().toISOString()
  tasks[idx] = { ...tasks[idx], ...body, updatedAt: now }
  writeStore('engagements', tasks)
  return ok(tasks[idx])
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const tasks = readStore<EngagementTask[]>('engagements', [])
  const idx = tasks.findIndex(t => t.id === params.id)
  if (idx === -1) return fail('Task not found', 404, 'NOT_FOUND')

  tasks.splice(idx, 1)
  writeStore('engagements', tasks)
  return ok({ deleted: true })
}
