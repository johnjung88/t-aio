import { NextRequest } from 'next/server'
import { fail, ok } from '@/lib/api'
import { readStore } from '@/lib/store'
import { scrapeAndSave } from '@/lib/competitor-tracker'
import type { Account, Competitor } from '@/lib/types'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({})) as { accountId?: string }

  const competitors = readStore<Competitor[]>('competitors', [])
  const competitor = competitors.find(c => c.id === params.id)
  if (!competitor) return fail('Competitor not found', 404, 'NOT_FOUND')

  const accounts = readStore<Account[]>('accounts', [])
  const account = body.accountId
    ? accounts.find(a => a.id === body.accountId)
    : accounts.find(a => a.loginEmail)
  if (!account) return fail('No account with login info', 400, 'NO_ACCOUNT')

  const collected = await scrapeAndSave(account, competitor)
  return ok({ collected, competitorId: competitor.id })
}
