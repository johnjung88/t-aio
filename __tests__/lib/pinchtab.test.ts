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
  getTabId,
  navigate,
  snapshot,
  click,
  fill,
  type as typeAction,
  press,
  waitForRef,
  evaluate,
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

// ── getTabId ──────────────────────────────────────────────────────────────────

describe('getTabId', () => {
  it('첫 번째 탭 id 반환', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({
      tabs: [
        { id: 'tab-abc', url: 'https://threads.com', title: 'Threads' },
      ],
    }))

    const id = await getTabId()

    expect(id).toBe('tab-abc')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/tabs')
  })

  it('탭이 없으면 에러 throw', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ tabs: [] }))

    await expect(getTabId()).rejects.toThrow('열린 탭 없음')
  })
})

// ── navigate ──────────────────────────────────────────────────────────────────

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

    const result = await snapshot()

    expect(result).toEqual(elements)
  })

  it('{ elements: [...] } 래퍼 파싱', async () => {
    const elements = [{ ref: 'e3', role: 'link' }]
    mockFetch.mockResolvedValueOnce(makeResponse({ elements }))

    const result = await snapshot()

    expect(result).toEqual(elements)
  })

  it('{ nodes: [...] } 래퍼 파싱', async () => {
    const nodes = [{ ref: 'e4', role: 'button' }]
    mockFetch.mockResolvedValueOnce(makeResponse({ nodes }))

    const result = await snapshot()

    expect(result).toEqual(nodes)
  })

  it('tabId 없이 호출됨 (쿼리스트링에 tabId 없음)', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([]))

    await snapshot()

    const [url] = mockFetch.mock.calls[0]
    expect(url).not.toContain('tabId')
    expect(url).toContain('/snapshot')
  })

  it('비정상 응답(not ok)이면 에러 throw', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(null, false, 500))

    await expect(snapshot()).rejects.toThrow('snapshot')
  })
})

// ── click / fill / type / press ───────────────────────────────────────────────

describe('actions', () => {
  it('click: kind=click과 ref를 전송 (tabId 없음)', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}))

    await click('ref-btn')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ kind: 'click', ref: 'ref-btn' })
    expect(body.tabId).toBeUndefined()
  })

  it('fill: kind=fill, ref, text를 전송', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}))

    await fill('ref-input', 'hello world')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ kind: 'fill', ref: 'ref-input', text: 'hello world' })
  })

  it('type: kind=type, ref, text를 전송', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}))

    await typeAction('ref-area', 'typed text')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ kind: 'type', ref: 'ref-area', text: 'typed text' })
  })

  it('press: kind=press, ref=keyboard, text=key를 전송', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}))

    await press('Enter')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ kind: 'press', ref: 'keyboard', text: 'Enter' })
  })
})

// ── waitForRef ────────────────────────────────────────────────────────────────

describe('waitForRef', () => {
  it('첫 스냅샷에서 매치되면 즉시 반환', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([{ ref: 'r1', role: 'button' }]))

    const ref = await waitForRef(els => els[0]?.ref ?? null)

    expect(ref).toBe('r1')
  })

  it('여러 번 폴링 후 매치', async () => {
    // 처음 두 번은 빈 배열, 세 번째에 매치
    mockFetch
      .mockResolvedValueOnce(makeResponse([]))
      .mockResolvedValueOnce(makeResponse([]))
      .mockResolvedValueOnce(makeResponse([{ ref: 'found' }]))

    const promise = waitForRef(els => els[0]?.ref ?? null, 15000)
    await vi.runAllTimersAsync()

    const ref = await promise
    expect(ref).toBe('found')
  })

  it('타임아웃 → 에러 throw', async () => {
    mockFetch.mockResolvedValue(makeResponse([]))

    const promise = waitForRef(() => null, 1000)
    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
    const assertion = expect(promise).rejects.toThrow('waitForRef timeout')
    await vi.runAllTimersAsync()
    await assertion
  })
})

// ── evaluate ──────────────────────────────────────────────────────────────────

describe('evaluate', () => {
  it('result 반환', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ result: 'https://threads.com/post/abc' }))

    const result = await evaluate(`document.querySelector('a')?.href`)

    expect(result).toBe('https://threads.com/post/abc')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.tabId).toBeUndefined()
    expect(body.expression).toContain('href')
  })

  it('error 응답이면 에러 throw', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'SyntaxError' }))

    await expect(evaluate('invalid[')).rejects.toThrow('evaluate error')
  })
})
