/**
 * Tier 1 E2E Tests — Pinchtab API Client
 *
 * 실제 Pinchtab 서버를 사용하여 API 클라이언트 동작을 검증.
 * Threads 계정 불필요 — example.com으로 테스트.
 *
 * 실행: npm run test:e2e:tier1
 * 전제: Pinchtab 서버가 실행 가능해야 함 (없으면 자동 시작 시도)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  ensureServer,
  ensureProfile,
  startInstance,
  stopInstance,
  openTab,
  navigate,
  snapshot,
  click,
  fill,
  type as typeAction,
  press,
  evaluate,
  getText,
  getCookies,
  setCookies,
} from '@/lib/pinchtab'

const PROFILE_NAME = 'e2e-test'
const TEST_URL = 'https://example.com'

let instanceId: string
let tabId: string

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await ensureServer()
  const profileId = await ensureProfile(PROFILE_NAME)
  instanceId = await startInstance(profileId)
  tabId = await openTab(instanceId, TEST_URL)
}, 30_000)

afterAll(async () => {
  try {
    await stopInstance(instanceId)
  } catch {
    // 정리 실패는 무시
  }
})

// ─── Server / Profile ─────────────────────────────────────────────────────────

describe('ensureServer', () => {
  it('멱등성 — 두 번 호출해도 에러 없음', async () => {
    await expect(ensureServer()).resolves.toBeUndefined()
  })
})

describe('ensureProfile', () => {
  it('동일 이름 재호출 시 동일 ID 반환', async () => {
    const id1 = await ensureProfile(PROFILE_NAME)
    const id2 = await ensureProfile(PROFILE_NAME)
    expect(id1).toBe(id2)
    expect(typeof id1).toBe('string')
    expect(id1.length).toBeGreaterThan(0)
  })
})

// ─── Navigation ───────────────────────────────────────────────────────────────

describe('navigate', () => {
  it('URL 이동 후 에러 없음', async () => {
    await expect(navigate(tabId, TEST_URL)).resolves.toBeUndefined()
  })
})

// ─── Snapshot ─────────────────────────────────────────────────────────────────

describe('snapshot', () => {
  it('배열 반환 및 ref 필드 존재', async () => {
    const elements = await snapshot(tabId)
    expect(Array.isArray(elements)).toBe(true)
    // 모든 요소에 ref 필드가 있어야 함
    for (const el of elements) {
      expect(el).toHaveProperty('ref')
      expect(typeof el.ref).toBe('string')
    }
  })

  it('example.com에 링크 요소 존재', async () => {
    const elements = await snapshot(tabId)
    const hasLink = elements.some(e => e.role === 'link' || typeof e.href === 'string')
    expect(hasLink).toBe(true)
  })
})

// ─── Click ────────────────────────────────────────────────────────────────────

describe('click', () => {
  it('링크 클릭 후 복원', async () => {
    const elements = await snapshot(tabId)
    const linkEl = elements.find(e => typeof e.href === 'string')

    if (!linkEl) {
      // 링크가 없으면 스킵 (비정상적인 페이지 상태)
      console.warn('[e2e] example.com에서 링크 요소를 찾지 못해 click 테스트 스킵')
      return
    }

    await expect(click(tabId, linkEl.ref)).resolves.toBeUndefined()
    // 원래 URL로 복원
    await navigate(tabId, TEST_URL)
  })
})

// ─── Fill / Type / Press ──────────────────────────────────────────────────────

describe('fill / type / press', () => {
  beforeAll(async () => {
    // evaluate로 input 요소를 동적으로 주입
    await evaluate(
      tabId,
      `
      const inp = document.createElement('input');
      inp.id = 'e2e-input';
      inp.type = 'text';
      document.body.appendChild(inp);
      inp.focus();
      `
    )
  })

  it('evaluate로 주입한 input에 fill 동작', async () => {
    const elements = await snapshot(tabId)
    const inputEl = elements.find(e => e.tag === 'input' || e.role === 'textbox')

    if (!inputEl) {
      console.warn('[e2e] fill용 input 요소 미발견 — 스킵')
      return
    }

    await expect(fill(tabId, inputEl.ref, 'fill-test')).resolves.toBeUndefined()
  })

  it('evaluate로 주입한 input에 type 동작', async () => {
    const elements = await snapshot(tabId)
    const inputEl = elements.find(e => e.tag === 'input' || e.role === 'textbox')

    if (!inputEl) {
      console.warn('[e2e] type용 input 요소 미발견 — 스킵')
      return
    }

    await expect(typeAction(tabId, inputEl.ref, 'typed')).resolves.toBeUndefined()
  })

  it('press — Enter 키 이벤트 전송', async () => {
    await expect(press(tabId, 'Enter')).resolves.toBeUndefined()
  })
})

// ─── Evaluate ─────────────────────────────────────────────────────────────────

describe('evaluate', () => {
  it('document.title 읽기', async () => {
    await navigate(tabId, TEST_URL)
    const title = await evaluate(tabId, 'document.title')
    expect(typeof title).toBe('string')
    expect((title as string).length).toBeGreaterThan(0)
  })

  it('DOM 수정 후 값 반환', async () => {
    const result = await evaluate(tabId, `
      document.body.setAttribute('data-e2e', 'ok');
      document.body.getAttribute('data-e2e')
    `)
    expect(result).toBe('ok')
  })
})

// ─── getText ──────────────────────────────────────────────────────────────────

describe('getText', () => {
  it('"Example Domain" 텍스트 포함', async () => {
    await navigate(tabId, TEST_URL)
    const text = await getText(tabId)
    expect(typeof text).toBe('string')
    expect(text).toContain('Example Domain')
  })
})

// ─── Cookies ──────────────────────────────────────────────────────────────────

describe('getCookies / setCookies', () => {
  it('라운드트립 — 설정한 쿠키를 읽어올 수 있음', async () => {
    const testCookie = {
      name: 'e2e_test_cookie',
      value: `val_${Date.now()}`,
      domain: 'example.com',
      path: '/',
    }

    await setCookies(tabId, [testCookie])
    const cookies = await getCookies(tabId)

    expect(Array.isArray(cookies)).toBe(true)
    const found = (cookies as Array<Record<string, unknown>>).find(
      c => c.name === testCookie.name
    )
    expect(found).toBeDefined()
    expect(found?.value).toBe(testCookie.value)
  })
})
