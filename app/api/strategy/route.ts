import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { parseStrategyInput, strategyBodySchema } from '@/lib/schemas'
import { readStore, writeStore } from '@/lib/store'
import type { StrategyConfig } from '@/lib/types'

const DEFAULT: StrategyConfig = {
  systemPromptBase: '',
  hookFormulas: [],
  optimalPostLength: 150,
  hashtagStrategy: '본글 마지막 1개',
  bestPostTimes: ['07:30', '20:00'],
  replyCount: 3,
  commentDelayMin: 20,
  commentDelayMax: 90,
}

export async function GET() {
  return ok(readStore<StrategyConfig>('strategy', DEFAULT))
}

export async function PUT(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = strategyBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const strategy = parseStrategyInput(parsed.data as StrategyConfig)

  writeStore('strategy', strategy)
  return ok(strategy)
}
