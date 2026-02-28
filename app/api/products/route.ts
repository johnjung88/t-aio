import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { normalizeProducts } from '@/lib/entities'
import { productCreateBodySchema, type ProductCreateInput } from '@/lib/schemas'
import { readStore, writeStore } from '@/lib/store'
import type { AffiliateProduct } from '@/lib/types'

export async function GET() {
  const products = normalizeProducts(readStore<AffiliateProduct[]>('affiliates', []))
  writeStore('affiliates', products)
  products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return ok(products)
}

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = productCreateBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const body = parsed.data as ProductCreateInput
  const now = new Date().toISOString()
  const products = normalizeProducts(readStore<AffiliateProduct[]>('affiliates', []))

  const newProduct: AffiliateProduct = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    name: body.name,
    url: body.url,
    platform: body.platform ?? 'coupang',
    category: body.category ?? '기타',
    price: body.price,
    originalPrice: body.originalPrice,
    description: body.description,
    hookKeywords: body.hookKeywords ?? [],
    useCount: 0,
  }

  products.push(newProduct)
  writeStore('affiliates', products)
  return ok(newProduct, 201)
}
