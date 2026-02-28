import { NextRequest, NextResponse } from 'next/server'
import { getStatus, startJob, stopJob, syncWithAccounts } from '@/lib/scheduler'
import { readStore, writeStore } from '@/lib/store'
import type { Account } from '@/lib/types'

export async function GET() {
  return NextResponse.json(getStatus())
}

export async function POST(req: NextRequest) {
  const { action, accountId, time } = await req.json()

  switch (action) {
    case 'start':
      startJob(accountId, time ?? '08:00')
      return NextResponse.json({ ok: true, message: `Started job for ${accountId}` })

    case 'stop':
      stopJob(accountId)
      return NextResponse.json({ ok: true, message: `Stopped job for ${accountId}` })

    case 'toggle': {
      const accounts = readStore<Account[]>('accounts', [])
      const idx = accounts.findIndex((a) => a.id === accountId)
      if (idx === -1) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

      const enabled = !accounts[idx].autoGenEnabled
      accounts[idx].autoGenEnabled = enabled
      if (time) accounts[idx].autoGenTime = time
      writeStore('accounts', accounts)

      if (enabled) startJob(accountId, accounts[idx].autoGenTime)
      else stopJob(accountId)

      return NextResponse.json({ ok: true, enabled })
    }

    case 'sync':
      syncWithAccounts()
      return NextResponse.json({ ok: true })

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
