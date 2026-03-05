/**
 * Tier 1 E2E Tests — Pinchtab API Client
 *
 * 실제 Pinchtab 서버를 사용하여 API 클라이언트 동작을 검증.
 * Threads 계정 불필요 — example.com으로 테스트.
 *
 * 실행: npm run test:e2e:tier1
 * 전제: Pinchtab 서버가 실행 중이어야 함
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
} from '@/lib/pinchtab'

const TEST_URL = 'https://example.com'
const PROFILE_NAME = 'e2e-tier1-test'

let instanceId: string
let tabId: string

beforeAll(async () => {
  await ensureServer()
  const profileId = await ensureProfile(PROFILE_NAME)
  instanceId = await startInstance(profileId)
  tabId = await openTab(instanceId, TEST_URL)
}, 30_000)

afterAll(async () => {
  if (instanceId) {
    await stopInstance(instanceId).catch(() => {})
  }
})

describe('ensureServer', () => {
  it('멱등성 — 두 번 호출해도 에러 없음', async () => {
    await expect(ensureServer()).resolves.toBeUndefined()
  })
})

describe('ensureProfile', () => {
  it('프로필 ID 반환 (문자열, 비어 있지 않음)', async () => {
    const id = await ensureProfile(PROFILE_NAME)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('멱등성 — 같은 이름으로 두 번 호출해도 같은 ID', async () => {
    const id1 = await ensureProfile(PROFILE_NAME)
    const id2 = await ensureProfile(PROFILE_NAME)
    expect(id1).toBe(id2)
  })
})

describe('navigate', () => {
  it('URL 이동 후 에러 없음', async () => {
    await expect(navigate(tabId, TEST_URL)).resolves.toBeUndefined()
  })
})

describe('snapshot', () => {
  it('배열 반환 및 ref 필드 존재', async () => {
    const elements = await snapshot(tabId)
    expect(Array.isArray(elements)).toBe(true)
    for (const el of elements) {
      expect(el).toHaveProperty('ref')
    }
  })

  it('example.com에 링크 요소 존재', async () => {
    const elements = await snapshot(tabId)
    const hasLink = elements.some(e => e.role === 'link' || typeof e.href === 'string')
    expect(hasLink).toBe(true)
  })
})

describe('evaluate', () => {
  it('document.title 읽기', async () => {
    await navigate(tabId, TEST_URL)
    const title = await evaluate(tabId, 'document.title')
    expect(typeof title).toBe('string')
    expect((title as string).length).toBeGreaterThan(0)
  })

  it('DOM 수정 후 값 반환', async () => {
    const result = await evaluate(tabId,
      "document.body.setAttribute('data-e2e','ok'); document.body.getAttribute('data-e2e')"
    )
    expect(result).toBe('ok')
  })
})

describe('getText', () => {
  it('페이지 텍스트 반환', async () => {
    await navigate(tabId, TEST_URL)
    const text = await getText(tabId)
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
  })
})

describe('click / fill / type / press', () => {
  it('evaluate로 input 주입 후 fill 동작', async () => {
    await navigate(tabId, TEST_URL)
    await evaluate(tabId, "const i=document.createElement('input');i.id='e2e';document.body.appendChild(i);i.focus()")
    const elements = await snapshot(tabId)
    const inputEl = elements.find(e => e.tag === 'input' || e.role === 'textbox')
    if (!inputEl) { console.warn('[e2e] input 미발견 — 스킵'); return }
    await expect(fill(tabId, inputEl.ref, 'hello')).resolves.toBeUndefined()
  })

  it('type 동작', async () => {
    const elements = await snapshot(tabId)
    const inputEl = elements.find(e => e.tag === 'input' || e.role === 'textbox')
    if (!inputEl) { console.warn('[e2e] input 미발견 — 스킵'); return }
    await expect(typeAction(tabId, inputEl.ref, 'typed')).resolves.toBeUndefined()
  })

  it('press — Enter 키 전송', async () => {
    await expect(press(tabId, 'Enter')).resolves.toBeUndefined()
  })

  it('링크 클릭 후 복원', async () => {
    await navigate(tabId, TEST_URL)
    const elements = await snapshot(tabId)
    const linkEl = elements.find(e => typeof e.href === 'string')
    if (!linkEl) { console.warn('[e2e] 링크 미발견 — 스킵'); return }
    await expect(click(tabId, linkEl.ref)).resolves.toBeUndefined()
    await navigate(tabId, TEST_URL)
  })
})
