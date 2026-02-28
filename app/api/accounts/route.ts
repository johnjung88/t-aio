import { NextRequest, NextResponse } from 'next/server'
import { readStore, writeStore } from '@/lib/store'
import type { Account } from '@/lib/types'

export async function GET() {
  return NextResponse.json(readStore<Account[]>('accounts', []))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const accounts = readStore<Account[]>('accounts', [])

  const newAccount: Account = {
    id: crypto.randomUUID(),
    username: body.username,
    displayName: body.displayName ?? body.username,
    niche: body.niche ?? '일반',
    timezone: body.timezone ?? 'Asia/Seoul',
    dailyPostTarget: body.dailyPostTarget ?? 2,
    autoGenEnabled: false,
    autoGenTime: body.autoGenTime ?? '08:00',
    categories: body.categories ?? [],
  }

  accounts.push(newAccount)
  writeStore('accounts', accounts)
  return NextResponse.json(newAccount, { status: 201 })
}
