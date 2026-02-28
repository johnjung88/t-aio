import { NextRequest, NextResponse } from 'next/server'
import { readStore, writeStore } from '@/lib/store'
import type { AffiliateProduct } from '@/lib/types'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const products = readStore<AffiliateProduct[]>('affiliates', [])
  const idx = products.findIndex((p) => p.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  products[idx] = { ...products[idx], ...body }
  writeStore('affiliates', products)
  return NextResponse.json(products[idx])
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const products = readStore<AffiliateProduct[]>('affiliates', [])
  writeStore('affiliates', products.filter((p) => p.id !== params.id))
  return NextResponse.json({ ok: true })
}
