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
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'accounts-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir)
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

async function getHandlers() {
  const mod = await import('@/app/api/accounts/route')
  return { GET: mod.GET, POST: mod.POST }
}

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/api/accounts', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

type MockResponse = { body: { success: boolean; data: unknown; error: unknown }; status: number }

describe('GET /api/accounts', () => {
  it('빈 목록을 반환한다', async () => {
    const { GET } = await getHandlers()
    const res = (await GET()) as MockResponse
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})

describe('POST /api/accounts', () => {
  it('새 계정을 생성하고 201을 반환한다', async () => {
    const { POST } = await getHandlers()
    const req = makeRequest('POST', {
      username: 'john_doe',
      displayName: 'John',
      niche: '뷰티',
    })
    const res = (await POST(req as never)) as MockResponse
    expect(res.status).toBe(201)

    const account = res.body.data as {
      username: string
      displayName: string
      niche: string
      timezone: string
      autoGenEnabled: boolean
    }
    expect(account.username).toBe('john_doe')
    expect(account.displayName).toBe('John')
    expect(account.timezone).toBe('Asia/Seoul')
    expect(account.autoGenEnabled).toBe(false)
  })

  it('username 기반 기본 displayName 설정', async () => {
    const { POST } = await getHandlers()
    const req = makeRequest('POST', { username: 'jane' })
    const res = (await POST(req as never)) as MockResponse
    const account = res.body.data as { displayName: string }
    expect(account.displayName).toBe('jane')
  })

  it('username 누락 시 400을 반환한다', async () => {
    const { POST } = await getHandlers()
    const req = makeRequest('POST', { displayName: 'No Username' })
    const res = (await POST(req as never)) as MockResponse
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})
