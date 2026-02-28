import { NextRequest, NextResponse } from 'next/server'
import { readStore, writeStore } from '@/lib/store'
import type { AffiliateProduct } from '@/lib/types'

export async function GET() {
  const products = readStore<AffiliateProduct[]>('affiliates', [])
  products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const products = readStore<AffiliateProduct[]>('affiliates', [])

  const newProduct: AffiliateProduct = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: body.name,
    url: body.url,
    platform: body.platform ?? 'coupang',
    category: body.category ?? '기타',
    price: body.price,
    description: body.description,
    hookKeywords: body.hookKeywords ?? [],
    useCount: 0,
  }

  products.push(newProduct)
  writeStore('affiliates', products)

  return NextResponse.json(newProduct, { status: 201 })
}
