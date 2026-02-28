import { NextRequest, NextResponse } from 'next/server'
import { readStore, writeStore } from '@/lib/store'
import type { StrategyConfig } from '@/lib/types'

const DEFAULT_STRATEGY: StrategyConfig = {
  systemPromptBase: '',
  hookFormulas: [],
  optimalPostLength: 150,
  hashtagStrategy: '댓글 마지막에 2-3개',
  bestPostTimes: ['07:00', '12:00', '21:00'],
  replyCount: 3,
}

export async function GET() {
  return NextResponse.json(readStore<StrategyConfig>('strategy', DEFAULT_STRATEGY))
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  writeStore('strategy', body)
  return NextResponse.json(body)
}
