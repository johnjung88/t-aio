import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { normalizeProducts } from '@/lib/entities'
import { removeUndefined } from '@/lib/object'
import { productPatchBodySchema } from '@/lib/schemas'
import { readStore, writeStore } from '@/lib/store'
import type { AffiliateProduct } from '@/lib/types'

interface Context {
  params: { id: string }
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const rawBody: unknown = await req.json()
  const parsed = productPatchBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const products = normalizeProducts(readStore<AffiliateProduct[]>('affiliates', []))
  const index = products.findIndex((item) => item.id === params.id)
  if (index === -1) return fail('Product not found', 404, 'NOT_FOUND')

  const updates = removeUndefined(parsed.data as Record<string, unknown>)

  products[index] = {
    ...products[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  writeStore('affiliates', products)
  return ok(products[index])
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const products = normalizeProducts(readStore<AffiliateProduct[]>('affiliates', []))
  const exists = products.some((item) => item.id === params.id)
  if (!exists) return fail('Product not found', 404, 'NOT_FOUND')

  writeStore('affiliates', products.filter((item) => item.id !== params.id))
  return ok({ id: params.id, deleted: true })
}
