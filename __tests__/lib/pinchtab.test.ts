// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── vi.hoisted ensures mock variables are defined before vi.mock factory runs ─

const {
  mockLaunch,
  mockNewContext,
  mockNewPage,
  mockPageEvaluate,
  mockPageClose,
  mockGoto,
  mockLocator,
  mockClick,
  mockFill,
  mockPressSequentially,
  mockKeyboardPress,
  mockInnerText,
  mockStorageState,
  mockAddInitScript,
  mockIsConnected,
  mockFsExistsSync,
  mockFsMkdirSync,
  mockFsReadFileSync,
  mockFsWriteFileSync,
} = vi.hoisted(() => {
  const mockPressSequentially = vi.fn().mockResolvedValue(undefined)
  const mockFill = vi.fn().mockResolvedValue(undefined)
  const mockClick = vi.fn().mockResolvedValue(undefined)
  const mockLocator = vi.fn(() => ({
    click: mockClick,
    fill: mockFill,
    pressSequentially: mockPressSequentially,
  }))
  const mockKeyboardPress = vi.fn().mockResolvedValue(undefined)
  const mockGoto = vi.fn().mockResolvedValue(undefined)
  const mockInnerText = vi.fn().mockResolvedValue('page body text')
  const mockPageEvaluate = vi.fn().mockResolvedValue([])
  const mockPageClose = vi.fn().mockResolvedValue(undefined)
  const mockStorageState = vi.fn().mockResolvedValue({ cookies: [], origins: [] })
  const mockAddInitScript = vi.fn().mockResolvedValue(undefined)
  const mockNewPage = vi.fn().mockResolvedValue({
    goto: mockGoto,
    locator: mockLocator,
    keyboard: { press: mockKeyboardPress },
    evaluate: mockPageEvaluate,
    innerText: mockInnerText,
    close: mockPageClose,
  })
  const mockIsConnected = vi.fn(() => false)
  const mockNewContext = vi.fn().mockResolvedValue({
    newPage: mockNewPage,
    storageState: mockStorageState,
    addInitScript: mockAddInitScript,
  })
  const mockLaunch = vi.fn().mockResolvedValue({
    isConnected: mockIsConnected,
    newContext: mockNewContext,
  })
  const mockFsExistsSync = vi.fn(() => false)
  const mockFsMkdirSync = vi.fn()
  const mockFsReadFileSync = vi.fn(() => '{}')
  const mockFsWriteFileSync = vi.fn()

  return {
    mockLaunch,
    mockNewContext,
    mockNewPage,
    mockPageEvaluate,
    mockPageClose,
    mockGoto,
    mockLocator,
    mockClick,
    mockFill,
    mockPressSequentially,
    mockKeyboardPress,
    mockInnerText,
    mockStorageState,
    mockAddInitScript,
    mockIsConnected,
    mockFsExistsSync,
    mockFsMkdirSync,
    mockFsReadFileSync,
    mockFsWriteFileSync,
  }
})

// ── Mock modules ──────────────────────────────────────────────────────────────

vi.mock('fs', () => ({
  mkdirSync: mockFsMkdirSync,
  existsSync: mockFsExistsSync,
  readFileSync: mockFsReadFileSync,
  writeFileSync: mockFsWriteFileSync,
}))

vi.mock('playwright', () => ({
  chromium: {
    launch: mockLaunch,
  },
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  ensureServer,
  ensureProfile,
  startInstance,
  stopInstance,
  openTab,
  closeTab,
  navigate,
  snapshot,
  click,
  fill,
  type as typeAction,
  press,
  waitForRef,
  evaluate,
  getText,
} from '@/lib/pinchtab'

// ── Setup ─────────────────────────────────────────────────────────────────────

// Fresh mock page object shared across tests (rebuilt each beforeEach)
let mockPage: ReturnType<typeof buildMockPage>

function buildMockPage() {
  return {
    goto: mockGoto,
    locator: mockLocator,
    keyboard: { press: mockKeyboardPress },
    evaluate: mockPageEvaluate,
    innerText: mockInnerText,
    close: mockPageClose,
  }
}

function buildMockCtx() {
  return {
    newPage: mockNewPage,
    storageState: mockStorageState,
    addInitScript: mockAddInitScript,
  }
}

function buildMockBrowser() {
  return {
    isConnected: mockIsConnected,
    newContext: mockNewContext,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPage = buildMockPage()
  mockIsConnected.mockReturnValue(false)
  mockLaunch.mockResolvedValue(buildMockBrowser())
  mockNewContext.mockResolvedValue(buildMockCtx())
  mockNewPage.mockResolvedValue(mockPage)
  mockPageEvaluate.mockResolvedValue([])
  mockGoto.mockResolvedValue(undefined)
  mockLocator.mockImplementation(() => ({
    click: mockClick,
    fill: mockFill,
    pressSequentially: mockPressSequentially,
  }))
  mockFsExistsSync.mockReturnValue(false)
})

afterEach(() => {
  vi.useRealTimers()
})

// ── ensureServer ──────────────────────────────────────────────────────────────

describe('ensureServer', () => {
  it('no-op: 아무것도 하지 않고 resolve', async () => {
    await expect(ensureServer()).resolves.toBeUndefined()
  })

  it('여러 번 호출해도 에러 없음', async () => {
    await ensureServer()
    await ensureServer()
    await ensureServer()
  })
})

// ── ensureProfile ──────────────────────────────────────────────────────────────

describe('ensureProfile', () => {
  it('전달된 name을 그대로 반환', async () => {
    const result = await ensureProfile('myProfile')
    expect(result).toBe('myProfile')
  })

  it('임의의 문자열도 그대로 반환', async () => {
    const result = await ensureProfile('user_123')
    expect(result).toBe('user_123')
  })
})

// ── startInstance ──────────────────────────────────────────────────────────────

describe('startInstance', () => {
  it('profileName을 반환하고 BrowserContext를 생성', async () => {
    const result = await startInstance('profileA_startInst')
    expect(result).toBe('profileA_startInst')
    expect(mockLaunch).toHaveBeenCalledOnce()
    expect(mockNewContext).toHaveBeenCalledOnce()
  })

  it('새 profileName이면 새 context 생성', async () => {
    await startInstance('profileX_si')
    await startInstance('profileY_si')
    expect(mockNewContext).toHaveBeenCalledTimes(2)
  })
})

// ── stopInstance ──────────────────────────────────────────────────────────────

describe('stopInstance', () => {
  it('존재하지 않는 instanceId는 조용히 무시', async () => {
    await expect(stopInstance('nonexistent-instance')).resolves.toBeUndefined()
  })

  it('존재하는 instance이면 storageState 저장 시도', async () => {
    const profileName = 'profileStop_si'
    await startInstance(profileName)
    await stopInstance(profileName)
    expect(mockStorageState).toHaveBeenCalledOnce()
  })
})

// ── openTab ──────────────────────────────────────────────────────────────────

describe('openTab', () => {
  it('tabId 반환 (tab_N 형식)', async () => {
    await startInstance('profileOpen_ot')
    const tabId = await openTab('profileOpen_ot')
    expect(tabId).toMatch(/^tab_\d+$/)
  })

  it('url 전달 시 page.goto 호출', async () => {
    await startInstance('profileOpenUrl_ot')
    await openTab('profileOpenUrl_ot', 'https://example.com')
    expect(mockGoto).toHaveBeenCalledWith('https://example.com', expect.objectContaining({ waitUntil: 'domcontentloaded' }))
  })

  it('url 없으면 goto 호출 안 함', async () => {
    await startInstance('profileOpenNoUrl_ot')
    await openTab('profileOpenNoUrl_ot')
    expect(mockGoto).not.toHaveBeenCalled()
  })

  it('연속 호출 시 tabId가 고유하게 증가', async () => {
    await startInstance('profileOpenSeq_ot')
    const t1 = await openTab('profileOpenSeq_ot')
    const t2 = await openTab('profileOpenSeq_ot')
    expect(t1).not.toBe(t2)
    const n1 = parseInt(t1.replace('tab_', ''))
    const n2 = parseInt(t2.replace('tab_', ''))
    expect(n2).toBeGreaterThan(n1)
  })
})

// ── navigate ──────────────────────────────────────────────────────────────────

describe('navigate', () => {
  it('page.goto 호출', async () => {
    await startInstance('profileNav_nav')
    const tabId = await openTab('profileNav_nav')
    // goto was called during openTab? no — openTab with no url doesn't call goto
    mockGoto.mockClear()
    await navigate(tabId, 'https://www.threads.net')
    expect(mockGoto).toHaveBeenCalledWith('https://www.threads.net', expect.objectContaining({ waitUntil: 'domcontentloaded' }))
  })

  it('존재하지 않는 tabId이면 에러 throw', async () => {
    await expect(navigate('tab_nonexistent_nav', 'https://example.com'))
      .rejects.toThrow('[Playwright] Tab not found: tab_nonexistent_nav')
  })
})

// ── snapshot ──────────────────────────────────────────────────────────────────

describe('snapshot', () => {
  it('page.evaluate 결과를 SnapElement 배열로 반환', async () => {
    await startInstance('profileSnap_sn')
    const tabId = await openTab('profileSnap_sn')
    const elements = [{ ref: 'e1', role: 'button', name: 'Test' }]
    mockPageEvaluate.mockResolvedValueOnce(elements)
    const result = await snapshot(tabId)
    expect(result).toEqual(elements)
    expect(mockPageEvaluate).toHaveBeenCalled()
  })

  it('빈 배열도 정상 반환', async () => {
    await startInstance('profileSnapEmpty_sn')
    const tabId = await openTab('profileSnapEmpty_sn')
    mockPageEvaluate.mockResolvedValueOnce([])
    const result = await snapshot(tabId)
    expect(result).toEqual([])
  })

  it('존재하지 않는 tabId이면 에러 throw', async () => {
    await expect(snapshot('tab_missing_sn'))
      .rejects.toThrow('[Playwright] Tab not found: tab_missing_sn')
  })
})

// ── click ──────────────────────────────────────────────────────────────────────

describe('click', () => {
  it('page.locator([data-ptref="ref"]).click() 호출', async () => {
    await startInstance('profileClick_cl')
    const tabId = await openTab('profileClick_cl')
    await click(tabId, 'btn-ref')
    expect(mockLocator).toHaveBeenCalledWith('[data-ptref="btn-ref"]')
    expect(mockClick).toHaveBeenCalledOnce()
  })

  it('존재하지 않는 tabId이면 에러 throw', async () => {
    await expect(click('tab_missing_cl', 'ref'))
      .rejects.toThrow('[Playwright] Tab not found: tab_missing_cl')
  })
})

// ── fill ──────────────────────────────────────────────────────────────────────

describe('fill', () => {
  it('page.locator([data-ptref="ref"]).fill(text) 호출', async () => {
    await startInstance('profileFill_fl')
    const tabId = await openTab('profileFill_fl')
    await fill(tabId, 'input-ref', 'hello world')
    expect(mockLocator).toHaveBeenCalledWith('[data-ptref="input-ref"]')
    expect(mockFill).toHaveBeenCalledWith('hello world', expect.anything())
  })

  it('존재하지 않는 tabId이면 에러 throw', async () => {
    await expect(fill('tab_missing_fl', 'ref', 'text'))
      .rejects.toThrow('[Playwright] Tab not found: tab_missing_fl')
  })
})

// ── type ──────────────────────────────────────────────────────────────────────

describe('type', () => {
  it('page.locator([data-ptref="ref"]).pressSequentially(text) 호출', async () => {
    await startInstance('profileType_ty')
    const tabId = await openTab('profileType_ty')
    await typeAction(tabId, 'textarea-ref', 'typed text')
    expect(mockLocator).toHaveBeenCalledWith('[data-ptref="textarea-ref"]')
    expect(mockPressSequentially).toHaveBeenCalledWith('typed text', expect.anything())
  })

  it('존재하지 않는 tabId이면 에러 throw', async () => {
    await expect(typeAction('tab_missing_ty', 'ref', 'text'))
      .rejects.toThrow('[Playwright] Tab not found: tab_missing_ty')
  })
})

// ── press ──────────────────────────────────────────────────────────────────────

describe('press', () => {
  it('page.keyboard.press(key) 호출', async () => {
    await startInstance('profilePress_pr')
    const tabId = await openTab('profilePress_pr')
    await press(tabId, 'Enter')
    expect(mockKeyboardPress).toHaveBeenCalledWith('Enter')
  })

  it('존재하지 않는 tabId이면 에러 throw', async () => {
    await expect(press('tab_missing_pr', 'Enter'))
      .rejects.toThrow('[Playwright] Tab not found: tab_missing_pr')
  })
})

// ── waitForRef ────────────────────────────────────────────────────────────────

describe('waitForRef', () => {
  it('첫 스냅샷에서 매치되면 즉시 반환', async () => {
    await startInstance('profileWait1_wfr')
    const tabId = await openTab('profileWait1_wfr')
    const elements = [{ ref: 'r1', role: 'button', name: 'Test' }]
    mockPageEvaluate.mockResolvedValue(elements)
    const ref = await waitForRef(tabId, els => els[0]?.ref ?? null)
    expect(ref).toBe('r1')
  })

  it('여러 번 폴링 후 매치', async () => {
    vi.useFakeTimers()
    await startInstance('profileWait2_wfr')
    const tabId = await openTab('profileWait2_wfr')

    mockPageEvaluate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ref: 'found', role: 'button' }])

    const promise = waitForRef(tabId, els => els[0]?.ref ?? null, 15000)
    await vi.runAllTimersAsync()
    const ref = await promise
    expect(ref).toBe('found')
  })

  it('타임아웃 → 에러 throw', async () => {
    vi.useFakeTimers()
    await startInstance('profileWait3_wfr')
    const tabId = await openTab('profileWait3_wfr')
    mockPageEvaluate.mockResolvedValue([])

    const promise = waitForRef(tabId, () => null, 1000)
    const assertion = expect(promise).rejects.toThrow('[Playwright] waitForRef timeout (1000ms)')
    await vi.runAllTimersAsync()
    await assertion
  })

  it('존재하지 않는 tabId이면 에러 throw', async () => {
    await expect(waitForRef('tab_missing_wfr', () => null))
      .rejects.toThrow('[Playwright] Tab not found: tab_missing_wfr')
  })
})

// ── evaluate ──────────────────────────────────────────────────────────────────

describe('evaluate', () => {
  it('page.evaluate 결과 반환', async () => {
    await startInstance('profileEval_ev')
    const tabId = await openTab('profileEval_ev')
    mockPageEvaluate.mockResolvedValueOnce('https://threads.net/post/abc')
    const result = await evaluate(tabId, `document.querySelector('a')?.href`)
    expect(result).toBe('https://threads.net/post/abc')
  })

  it('존재하지 않는 tabId이면 에러 throw', async () => {
    await expect(evaluate('tab_missing_ev', 'expression'))
      .rejects.toThrow('[Playwright] Tab not found: tab_missing_ev')
  })
})

// ── getText ───────────────────────────────────────────────────────────────────

describe('getText', () => {
  it('page.innerText("body") 결과 반환', async () => {
    await startInstance('profileGetText_gt')
    const tabId = await openTab('profileGetText_gt')
    mockInnerText.mockResolvedValueOnce('page body content')
    const text = await getText(tabId)
    expect(text).toBe('page body content')
    expect(mockInnerText).toHaveBeenCalledWith('body')
  })

  it('존재하지 않는 tabId이면 에러 throw', async () => {
    await expect(getText('tab_missing_gt'))
      .rejects.toThrow('[Playwright] Tab not found: tab_missing_gt')
  })
})

// ── closeTab ─────────────────────────────────────────────────────────────────

describe('closeTab', () => {
  it('page.close() 호출 후 tab 제거', async () => {
    await startInstance('profileCloseTab_ct')
    const tabId = await openTab('profileCloseTab_ct')
    await closeTab(tabId)
    expect(mockPageClose).toHaveBeenCalledOnce()
  })

  it('존재하지 않는 tabId는 조용히 무시', async () => {
    await expect(closeTab('tab_nonexistent_ct')).resolves.toBeUndefined()
  })
})
