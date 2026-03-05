import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { competitorPatchBodySchema } from '@/lib/schemas'
import { readStore, writeStore } from '@/lib/store'
import type { Competitor, CompetitorPost } from '@/lib/types'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const competitors = readStore<Competitor[]>('competitors', [])
  const competitor = competitors.find(c => c.id === params.id)
  if (!competitor) return fail('Competitor not found', 404, 'NOT_FOUND')

  const posts = readStore<CompetitorPost[]>('competitor-posts', [])
    .filter(p => p.competitorId === params.id)
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))
    .slice(0, 20)

  return ok({ ...competitor, recentPosts: posts })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rawBody: unknown = await req.json()
  const parsed = competitorPatchBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const competitors = readStore<Competitor[]>('competitors', [])
  const idx = competitors.findIndex(c => c.id === params.id)
  if (idx === -1) return fail('Competitor not found', 404, 'NOT_FOUND')

  competitors[idx] = { ...competitors[idx], ...parsed.data, updatedAt: new Date().toISOString() }
  writeStore('competitors', competitors)
  return ok(competitors[idx])
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const competitors = readStore<Competitor[]>('competitors', [])
  const idx = competitors.findIndex(c => c.id === params.id)
  if (idx === -1) return fail('Competitor not found', 404, 'NOT_FOUND')

  competitors.splice(idx, 1)
  writeStore('competitors', competitors)

  // 관련 포스트도 삭제
  const posts = readStore<CompetitorPost[]>('competitor-posts', [])
    .filter(p => p.competitorId !== params.id)
  writeStore('competitor-posts', posts)

  return ok({ deleted: true })
}
