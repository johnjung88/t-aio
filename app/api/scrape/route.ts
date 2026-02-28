import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; T-AIO/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()

    // Extract basic metadata
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const ogTitleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
    const ogDescMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)
    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)

    // Try to extract price (Coupang pattern)
    const priceMatch = html.match(/(?:data-price|"price"|'price')\D*?(\d{3,7})/i)

    const name = (ogTitleMatch?.[1] ?? titleMatch?.[1] ?? '').trim().slice(0, 100)
    const description = (ogDescMatch?.[1] ?? descMatch?.[1] ?? '').trim().slice(0, 300)
    const price = priceMatch ? parseInt(priceMatch[1]) : undefined

    // Detect platform
    let platform: 'coupang' | 'naver' | 'other' = 'other'
    if (url.includes('coupang')) platform = 'coupang'
    else if (url.includes('naver') || url.includes('smartstore')) platform = 'naver'

    return NextResponse.json({ name, description, price, platform })
  } catch (err) {
    console.error('Scrape error:', err)
    return NextResponse.json({ name: '', description: '', price: undefined, platform: 'other' })
  }
}
