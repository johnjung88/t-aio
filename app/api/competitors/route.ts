import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { normalizeCompetitors } from '@/lib/entities'
import { competitorCreateBodySchema } from '@/lib/schemas'
import { readStore, writeStore } from '@/lib/store'
import type { Competitor } from '@/lib/types'

export async function GET() {
  const competitors = normalizeCompetitors(readStore<Competitor[]>('competitors', []))
  return ok(competitors)
}

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = competitorCreateBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const { username, displayName, niche } = parsed.data
  const now = new Date().toISOString()

  const competitor: Competitor = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    username,
    displayName,
    niche,
    trackingEnabled: true,
  }

  const competitors = readStore<Competitor[]>('competitors', [])
  competitors.push(competitor)
  writeStore('competitors', competitors)

  return ok(competitor, 201)
}
