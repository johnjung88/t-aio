import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { parseStrategyInput, strategyBodySchema } from '@/lib/schemas'
import { getStrategy, saveStrategy } from '@/lib/strategy-store'
import type { StrategyConfig } from '@/lib/types'

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('accountId') ?? 'default'
  return ok(getStrategy(accountId === 'default' ? undefined : accountId))
}

export async function PUT(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('accountId') ?? 'default'

  const rawBody: unknown = await req.json()
  const parsed = strategyBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const strategy = parseStrategyInput(parsed.data as StrategyConfig)
  saveStrategy(accountId, strategy)
  return ok(strategy)
}
