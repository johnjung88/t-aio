/**
 * Tier 1 E2E Tests — Pinchtab API Client
 *
 * 실제 Pinchtab 서버를 사용하여 API 클라이언트 동작을 검증.
 * Threads 계정 불필요 — example.com으로 테스트.
 *
 * 실행: npm run test:e2e:tier1
 * 전제: Pinchtab 서버가 실행 중이어야 함
 */
import { describe, it, expect, beforeAll } from 'vitest'
import {
  ensureServer,
  getTabId,
  navigate,
  snapshot,
  click,
  fill,
  type as typeAction,
  press,
  evaluate,
} from '@/lib/pinchtab'

const TEST_URL = 'https://example.com'

let tabId: string

beforeAll(async () => {
  await ensureServer()
  tabId = await getTabId()
  await navigate(tabId, TEST_URL)
}, 30_000)

describe('ensureServer', () => {
  it('멱등성 — 두 번 호출해도 에러 없음', async () => {
    await expect(ensureServer()).resolves.toBeUndefined()
  })
})

describe('getTabId', () => {
  it('탭 ID 반환 (문자열, 비어 있지 않음)', async () => {
    const id = await getTabId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })
})

describe('navigate', () => {
  it('URL 이동 후 에러 없음', async () => {
    await expect(navigate(tabId, TEST_URL)).resolves.toBeUndefined()
  })
})

describe('snapshot', () => {
  it('배열 반환 및 ref 필드 존재', async () => {
    const elements = await snapshot()
    expect(Array.isArray(elements)).toBe(true)
    for (const el of elements) {
      expect(el).toHaveProperty('ref')
    }
  })

  it('example.com에 링크 요소 존재', async () => {
    const elements = await snapshot()
    const hasLink = elements.some(e => e.role === 'link' || typeof e.href === 'string')
    expect(hasLink).toBe(true)
  })
})

describe('evaluate', () => {
  it('document.title 읽기', async () => {
    await navigate(tabId, TEST_URL)
    const title = await evaluate('document.title')
    expect(typeof title).toBe('string')
    expect((title as string).length).toBeGreaterThan(0)
  })

  it('DOM 수정 후 값 반환', async () => {
    const result = await evaluate(
      "document.body.setAttribute('data-e2e','ok'); document.body.getAttribute('data-e2e')"
    )
    expect(result).toBe('ok')
  })
})

describe('click / fill / type / press', () => {
  it('evaluate로 input 주입 후 fill 동작', async () => {
    await navigate(tabId, TEST_URL)
    await evaluate("const i=document.createElement('input');i.id='e2e';document.body.appendChild(i);i.focus()")
    const elements = await snapshot()
    const inputEl = elements.find(e => e.tag === 'input' || e.role === 'textbox')
    if (!inputEl) { console.warn('[e2e] input 미발견 — 스킵'); return }
    await expect(fill(inputEl.ref, 'hello')).resolves.toBeUndefined()
  })

  it('type 동작', async () => {
    const elements = await snapshot()
    const inputEl = elements.find(e => e.tag === 'input' || e.role === 'textbox')
    if (!inputEl) { console.warn('[e2e] input 미발견 — 스킵'); return }
    await expect(typeAction(inputEl.ref, 'typed')).resolves.toBeUndefined()
  })

  it('press — Enter 키 전송', async () => {
    await expect(press('Enter')).resolves.toBeUndefined()
  })

  it('링크 클릭 후 복원', async () => {
    await navigate(tabId, TEST_URL)
    const elements = await snapshot()
    const linkEl = elements.find(e => typeof e.href === 'string')
    if (!linkEl) { console.warn('[e2e] 링크 미발견 — 스킵'); return }
    await expect(click(linkEl.ref)).resolves.toBeUndefined()
    await navigate(tabId, TEST_URL)
  })
})
