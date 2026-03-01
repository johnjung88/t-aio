// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Mock next/server
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
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'posts-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir)
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

async function getHandlers() {
  const mod = await import('@/app/api/posts/route')
  return { GET: mod.GET, POST: mod.POST }
}

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

type MockResponse = { body: { success: boolean; data: unknown; error: unknown }; status: number }

describe('GET /api/posts', () => {
  it('빈 목록을 반환한다', async () => {
    const { GET } = await getHandlers()
    const req = makeRequest('GET', 'http://localhost/api/posts')
    const res = (await GET(req as never)) as MockResponse
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual([])
  })

  it('status 필터링이 동작한다', async () => {
    // 데이터 세팅
    const dataDir = path.join(tempDir, 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(
      path.join(dataDir, 'posts.json'),
      JSON.stringify([
        { id: '1', status: 'new', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', contentType: 'informational', topic: '', keywords: [], account: 'a', thread: { main: '' } },
        { id: '2', status: 'draft', createdAt: '2025-01-02T00:00:00Z', updatedAt: '2025-01-02T00:00:00Z', contentType: 'informational', topic: '', keywords: [], account: 'a', thread: { main: '' } },
      ])
    )

    const { GET } = await getHandlers()
    const req = makeRequest('GET', 'http://localhost/api/posts?status=new')
    const res = (await GET(req as never)) as MockResponse
    const posts = res.body.data as Array<{ id: string }>
    expect(posts).toHaveLength(1)
    expect(posts[0].id).toBe('1')
  })
})

describe('POST /api/posts', () => {
  it('새 포스트를 생성하고 201을 반환한다', async () => {
    const { POST } = await getHandlers()
    const req = makeRequest('POST', 'http://localhost/api/posts', {
      topic: '다이어트 제품',
      contentType: 'affiliate',
    })
    const res = (await POST(req as never)) as MockResponse
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)

    const post = res.body.data as { topic: string; status: string }
    expect(post.topic).toBe('다이어트 제품')
    expect(post.status).toBe('new')
  })

  it('잘못된 contentType으로 요청 시 400을 반환한다', async () => {
    const { POST } = await getHandlers()
    const req = makeRequest('POST', 'http://localhost/api/posts', {
      contentType: 'invalid_type',
    })
    const res = (await POST(req as never)) as MockResponse
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})
