import { NextRequest, NextResponse } from 'next/server'
import { readStore } from '@/lib/store'
import { selectProductForAccount } from '@/lib/product-selector'
import type { Account } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId') ?? 'default'

  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find((a) => a.id === accountId)
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const product = selectProductForAccount(account)
  return NextResponse.json({ product })
}
