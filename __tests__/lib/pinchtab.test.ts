// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── vi.hoisted ensures mockSpawn is defined before vi.mock factory runs ───────
const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }))

vi.mock('child_process', () => ({
  spawn: mockSpawn,
}))

// ── Import after mocks ────────────────────────────────────────────────────────
import {
  ensureServer,
  ensureProfile,
  startInstance,
  openTab,
  navigate,
  snapshot,
  click,
  fill,
  type as typeAction,
  press,
  waitForRef,
  getText,
} from '@/lib/pinchtab'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(String(body)),
  } as unknown as Response
}

const mockFetch = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  mockSpawn.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ── ensureServer ──────────────────────────────────────────────────────────────

describe('ensureServer', () => {
  it('서버 이미 실행 중이면 spawn을 호출하지 않는다', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ status: 'ok' }, true))

    await ensureServer()

    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('서버가 꺼져 있으면 spawn 후 health 대기 → 성공', async () => {
    // health check: 실패 → spawn → 첫 폴링 실패 → 두 번째 폴링 성공
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))  // isServerRunning() = false
      .mockRejectedValueOnce(new Error('not ready'))      // 첫 번째 폴링
      .mockResolvedValueOnce(makeResponse({ status: 'ok' }, true)) // 두 번째 폴링

    const mockChild = { unref: vi.fn() }
    mockSpawn.mockReturnValue(mockChild)

    const promise = ensureServer()
    // 각 500ms delay를 빠르게 진행
    await vi.runAllTimersAsync()

    await promise

    expect(mockSpawn).toHaveBeenCalledOnce()
    expect(mockChild.unref).toHaveBeenCalled()
  })

  it('10초 타임아웃 → 에러 throw', async () => {
    // 모든 health check 실패
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const mockChild = { unref: vi.fn() }
    mockSpawn.mockReturnValue(mockChild)

    const promise = ensureServer()
    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
    const assertion = expect(promise).rejects.toThrow('서버 시작 실패')
    await vi.runAllTimersAsync()
    await assertion
  })

  it('spawn에 올바른 옵션 전달 (detached, stdio, shell)', async () => {
    // health check: 실패 → spawn → 바로 성공
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(makeResponse({}, true))

    const mockChild = { unref: vi.fn() }
    mockSpawn.mockReturnValue(mockChild)

    const promise = ensureServer()
    await vi.runAllTimersAsync()
    await promise

    expect(mockSpawn).toHaveBeenCalledWith('pinchtab', [], {
      detached: true,
      stdio: 'ignore',
      shell: true,
    })
  })
})

// ── ensureProfile ─────────────────────────────────────────────────────────────

describe('ensureProfile', () => {
  it('기존 프로필이 있으면 해당 id 반환', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([
      { id: 'p1', name: 'alice' },
      { id: 'p2', name: 'bob' },
    ]))

    const id = await ensureProfile('alice')

    expect(id).toBe('p1')
    // POST가 발생하지 않아야 함
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('없으면 POST로 생성 후 새 id 반환', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse([]))   // GET /profiles
      .mockResolvedValueOnce(makeResponse({ id: 'newId', name: 'charlie' }))  // POST

    const id = await ensureProfile('charlie')

    expect(id).toBe('newId')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const [, postCall] = mockFetch.mock.calls
    expect(postCall[1]?.method).toBe('POST')
  })
})

// ── startInstance ─────────────────────────────────────────────────────────────

describe('startInstance', () => {
  it('기본 headless 모드 전송', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ id: 'inst1' }))

    const id = await startInstance('p1')

    expect(id).toBe('inst1')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.mode).toBe('headless')
  })

  it('headed=true이면 headed 모드 전송', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ id: 'inst2' }))

    await startInstance('p1', true)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.mode).toBe('headed')
  })
})

// ── openTab / navigate ────────────────────────────────────────────────────────

describe('openTab', () => {
  it('tabId 반환 및 올바른 body 전송', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ id: 'tab99' }))

    const tabId = await openTab('inst1', 'https://threads.net')

    expect(tabId).toBe('tab99')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).toEqual({ instanceId: 'inst1', url: 'https://threads.net' })
  })
})

describe('navigate', () => {
  it('올바른 경로로 POST', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}))

    await navigate('tab1', 'https://example.com/path')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/navigate')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ tabId: 'tab1', url: 'https://example.com/path' })
  })
})

// ── snapshot ──────────────────────────────────────────────────────────────────

describe('snapshot', () => {
  it('배열 응답 파싱', async () => {
    const elements = [{ ref: 'e1', role: 'button' }, { ref: 'e2', role: 'textbox' }]
    mockFetch.mockResolvedValueOnce(makeResponse(elements))

    const result = await snapshot('tab1')

    expect(result).toEqual(elements)
  })

  it('{ elements: [...] } 래퍼 파싱', async () => {
    const elements = [{ ref: 'e3', role: 'link' }]
    mockFetch.mockResolvedValueOnce(makeResponse({ elements }))

    const result = await snapshot('tab1')

    expect(result).toEqual(elements)
  })

  it('{ nodes: [...] } 래퍼 파싱', async () => {
    const nodes = [{ ref: 'e4', role: 'button' }]
    mockFetch.mockResolvedValueOnce(makeResponse({ nodes }))

    const result = await snapshot('tab1')

    expect(result).toEqual(nodes)
  })

  it('비정상 응답(not ok)이면 에러 throw', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(null, false, 500))

    await expect(snapshot('tab1')).rejects.toThrow('snapshot')
  })
})

// ── click / fill / type / press ───────────────────────────────────────────────

describe('actions', () => {
  it('click: kind=click과 ref를 전송', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}))

    await click('tab1', 'ref-btn')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ kind: 'click', ref: 'ref-btn' })
  })

  it('fill: kind=fill, ref, text를 전송', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}))

    await fill('tab1', 'ref-input', 'hello world')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ kind: 'fill', ref: 'ref-input', text: 'hello world' })
  })

  it('type: kind=type, ref, text를 전송', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}))

    await typeAction('tab1', 'ref-area', 'typed text')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ kind: 'type', ref: 'ref-area', text: 'typed text' })
  })

  it('press: kind=press, ref=keyboard, text=key를 전송', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}))

    await press('tab1', 'Enter')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ kind: 'press', ref: 'keyboard', text: 'Enter' })
  })
})

// ── waitForRef ────────────────────────────────────────────────────────────────

describe('waitForRef', () => {
  it('첫 스냅샷에서 매치되면 즉시 반환', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([{ ref: 'r1', role: 'button' }]))

    const ref = await waitForRef('tab1', els => els[0]?.ref ?? null)

    expect(ref).toBe('r1')
  })

  it('여러 번 폴링 후 매치', async () => {
    // 처음 두 번은 빈 배열, 세 번째에 매치
    mockFetch
      .mockResolvedValueOnce(makeResponse([]))
      .mockResolvedValueOnce(makeResponse([]))
      .mockResolvedValueOnce(makeResponse([{ ref: 'found' }]))

    const promise = waitForRef('tab1', els => els[0]?.ref ?? null, 15000)
    await vi.runAllTimersAsync()

    const ref = await promise
    expect(ref).toBe('found')
  })

  it('타임아웃 → 에러 throw', async () => {
    mockFetch.mockResolvedValue(makeResponse([]))

    const promise = waitForRef('tab1', () => null, 1000)
    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
    const assertion = expect(promise).rejects.toThrow('waitForRef timeout')
    await vi.runAllTimersAsync()
    await assertion
  })
})

// ── getText ───────────────────────────────────────────────────────────────────

describe('getText', () => {
  it('{ text: "..." } 응답 파싱', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ text: 'page content' }))

    const text = await getText('tab1')

    expect(text).toBe('page content')
  })

  it('문자열 응답 파싱', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve('raw string'),
      text: () => Promise.resolve('raw string'),
    } as unknown as Response)

    const text = await getText('tab1')

    expect(text).toBe('raw string')
  })
})
