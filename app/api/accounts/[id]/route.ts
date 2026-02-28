import { NextRequest, NextResponse } from 'next/server'
import { readStore, writeStore } from '@/lib/store'
import type { Account } from '@/lib/types'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const accounts = readStore<Account[]>('accounts', [])
  const idx = accounts.findIndex((a) => a.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  accounts[idx] = { ...accounts[idx], ...body }
  writeStore('accounts', accounts)
  return NextResponse.json(accounts[idx])
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const accounts = readStore<Account[]>('accounts', [])
  writeStore('accounts', accounts.filter((a) => a.id !== params.id))
  return NextResponse.json({ ok: true })
}
