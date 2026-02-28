import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { scrapeBodySchema, type ScrapeInput } from '@/lib/schemas'

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = scrapeBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const { url } = parsed.data as ScrapeInput
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; T-AIO/1.0)' },
      signal: AbortSignal.timeout(8000),
    })

    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const ogTitleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
    const ogDescMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)
    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)
    const priceMatch = html.match(/(?:data-price|"price"|'price')\D*?(\d{3,7})/i)
    const origPriceMatch = html.match(/(?:original[_-]?price|listPrice|normalPrice)\D*?(\d{3,7})/i)

    const name = (ogTitleMatch?.[1] ?? titleMatch?.[1] ?? '').trim().slice(0, 100)
    const description = (ogDescMatch?.[1] ?? descMatch?.[1] ?? '').trim().slice(0, 300)
    const price = priceMatch ? Number.parseInt(priceMatch[1], 10) : undefined
    const originalPrice = origPriceMatch ? Number.parseInt(origPriceMatch[1], 10) : undefined

    let platform: 'coupang' | 'naver' | 'other' = 'other'
    if (url.includes('coupang')) platform = 'coupang'
    else if (url.includes('naver') || url.includes('smartstore')) platform = 'naver'

    return ok({ name, description, price, originalPrice, platform })
  } catch {
    return ok({ name: '', description: '', price: undefined, originalPrice: undefined, platform: 'other' })
  }
}
