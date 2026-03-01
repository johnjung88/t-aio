// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

vi.mock('next/server', () => ({
  NextRequest: Request,
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}))

let tempDir: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'products-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir)
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

async function getHandlers() {
  const mod = await import('@/app/api/products/route')
  return { GET: mod.GET, POST: mod.POST }
}

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/api/products', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

type MockResponse = { body: { success: boolean; data: unknown; error: unknown }; status: number }

describe('GET /api/products', () => {
  it('빈 목록을 반환한다', async () => {
    const { GET } = await getHandlers()
    const res = (await GET()) as MockResponse
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})

describe('POST /api/products', () => {
  it('새 제품을 생성하고 201을 반환한다', async () => {
    const { POST } = await getHandlers()
    const req = makeRequest('POST', {
      name: '공기청정기',
      url: 'https://coupang.com/p/1',
      platform: 'coupang',
      price: 49900,
    })
    const res = (await POST(req as never)) as MockResponse
    expect(res.status).toBe(201)
    const product = res.body.data as { name: string; useCount: number }
    expect(product.name).toBe('공기청정기')
    expect(product.useCount).toBe(0)
  })

  it('name 누락 시 400을 반환한다', async () => {
    const { POST } = await getHandlers()
    const req = makeRequest('POST', { url: 'https://coupang.com/p/1' })
    const res = (await POST(req as never)) as MockResponse
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('잘못된 url 시 400을 반환한다', async () => {
    const { POST } = await getHandlers()
    const req = makeRequest('POST', { name: '제품', url: 'not-a-url' })
    const res = (await POST(req as never)) as MockResponse
    expect(res.status).toBe(400)
  })
})
