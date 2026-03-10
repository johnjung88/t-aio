# Pinchtab Instance Isolation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate pinchtab.ts from legacy single-instance API to multi-instance Profile/Instance/Tab API so multiple programs can use Pinchtab simultaneously without conflicts.

**Architecture:** Replace all legacy endpoints with new tab-scoped endpoints (`/tabs/{id}/action`, `/tabs/{id}/snapshot`, etc.). Each bot operation (publishPost, publishReply) creates its own Instance via a Profile, ensuring full isolation. Profiles persist sessions (cookies) across Instance restarts.

**Tech Stack:** TypeScript, Pinchtab HTTP API (localhost:9867), Vitest E2E

---

### Task 1: Rewrite `lib/pinchtab.ts` — New Multi-Instance API Client

**Files:**
- Rewrite: `lib/pinchtab.ts`

**Step 1: Write the new pinchtab.ts**

```typescript
import { spawn } from 'child_process'

const BASE = process.env.PINCHTAB_URL ?? 'http://127.0.0.1:9867'

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`[Pinchtab] ${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ─── Server Management ───────────────────────────────────────────────────────

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

export async function ensureServer(): Promise<void> {
  if (await isServerRunning()) return

  console.log('[Pinchtab] 서버 시작 중...')
  const child = spawn('pinchtab', [], {
    detached: true,
    stdio: 'ignore',
    shell: true,
  })
  child.unref()

  for (let i = 0; i < 20; i++) {
    await delay(500)
    if (await isServerRunning()) {
      console.log('[Pinchtab] 서버 준비 완료')
      return
    }
  }
  throw new Error('[Pinchtab] 서버 시작 실패 (10초 초과)')
}

// ─── Profiles ────────────────────────────────────────────────────────────────

interface ProfileInfo {
  id: string
  name: string
}

export async function ensureProfile(name: string): Promise<string> {
  const list = await api<ProfileInfo[]>('GET', '/profiles')
  const existing = list.find(p => p.name === name)
  if (existing) return existing.id

  const created = await api<{ status: string; name: string }>('POST', '/profiles', { name })
  // After creation, fetch the list again to get the id
  const updated = await api<ProfileInfo[]>('GET', '/profiles')
  const profile = updated.find(p => p.name === name)
  if (!profile) throw new Error(`[Pinchtab] 프로필 생성 실패: ${name}`)
  return profile.id
}

// ─── Instances ───────────────────────────────────────────────────────────────

interface InstanceInfo {
  id: string
  profileId: string
  profileName: string
  port: number
  headless: boolean
  status: string
  startTime: string
}

export async function startInstance(profileId: string, headless = true): Promise<string> {
  const mode = headless ? 'headless' : 'headed'
  const instance = await api<InstanceInfo>('POST', '/instances/start', { profileId, mode })
  return instance.id
}

export async function stopInstance(instanceId: string): Promise<void> {
  await api('POST', `/instances/${instanceId}/stop`)
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

export async function openTab(instanceId: string, url?: string): Promise<string> {
  const result = await api<{ tabId: string }>('POST', `/instances/${instanceId}/tabs/open`, url ? { url } : undefined)
  return result.tabId
}

export async function closeTab(tabId: string): Promise<void> {
  await api('POST', `/tabs/${tabId}/close`)
}

export async function navigate(tabId: string, url: string): Promise<void> {
  await api('POST', `/tabs/${tabId}/navigate`, { url })
}

// ─── Snapshot / Elements ────────────────────────────────────────────────────

export interface SnapElement {
  ref: string
  role?: string
  name?: string
  tag?: string
  type?: string
  text?: string
  placeholder?: string
  href?: string
  disabled?: boolean
  checked?: boolean
  [key: string]: unknown
}

export async function snapshot(tabId: string): Promise<SnapElement[]> {
  const res = await fetch(`${BASE}/tabs/${tabId}/snapshot?interactive=true&compact=true`)
  if (!res.ok) throw new Error(`[Pinchtab] snapshot → ${res.status}`)
  const data = await res.json() as { nodes?: SnapElement[]; elements?: SnapElement[] } | SnapElement[]
  if (Array.isArray(data)) return data
  return data.nodes ?? data.elements ?? []
}

// ─── Actions ────────────────────────────────────────────────────────────────

export async function click(tabId: string, ref: string): Promise<void> {
  await api('POST', `/tabs/${tabId}/action`, { kind: 'click', ref })
}

export async function fill(tabId: string, ref: string, text: string): Promise<void> {
  await api('POST', `/tabs/${tabId}/action`, { kind: 'fill', ref, text })
}

export async function type(tabId: string, ref: string, text: string): Promise<void> {
  await api('POST', `/tabs/${tabId}/action`, { kind: 'type', ref, text })
}

export async function press(tabId: string, key: string): Promise<void> {
  await api('POST', `/tabs/${tabId}/action`, { kind: 'press', ref: 'keyboard', text: key })
}

// ─── Wait Helpers ───────────────────────────────────────────────────────────

export async function waitForRef(
  tabId: string,
  matcher: (elements: SnapElement[]) => string | null,
  timeoutMs = 15000
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const elements = await snapshot(tabId)
    const ref = matcher(elements)
    if (ref) return ref
    await delay(800)
  }
  throw new Error(`[Pinchtab] waitForRef timeout (${timeoutMs}ms)`)
}

// ─── Evaluate / Text ────────────────────────────────────────────────────────

export async function evaluate(tabId: string, expression: string): Promise<unknown> {
  const res = await api<{ result?: unknown; error?: string }>('POST', `/tabs/${tabId}/evaluate`, { expression })
  if (res.error) throw new Error(`[Pinchtab] evaluate error: ${res.error}`)
  return res.result
}

export async function getText(tabId: string): Promise<string> {
  const res = await fetch(`${BASE}/tabs/${tabId}/text`)
  if (!res.ok) throw new Error(`[Pinchtab] getText → ${res.status}`)
  return res.text()
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit lib/pinchtab.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/pinchtab.ts
git commit -m "refactor(pinchtab): migrate to multi-instance API (Profile/Instance/Tab)"
```

---

### Task 2: Update `lib/threads-bot.ts` — Instance Lifecycle + tabId Plumbing

**Files:**
- Modify: `lib/threads-bot.ts`

**Step 1: Rewrite threads-bot.ts with instance lifecycle**

```typescript
import type { Account, ThreadPost } from './types'
import { readStore } from './store'
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
  type as typeText,
  evaluate,
  waitForRef,
  type SnapElement,
} from './pinchtab'

// ─── Login Check/Flow ─────────────────────────────────────────────────────────

function findRef(elements: SnapElement[], ...matchers: Array<(e: SnapElement) => boolean>): string | null {
  for (const matcher of matchers) {
    const found = elements.find(matcher)
    if (found) return found.ref
  }
  return null
}

async function ensureLoggedIn(tabId: string, account: Account): Promise<void> {
  const elements = await snapshot(tabId)

  const isLoginPage = elements.some(e =>
    e.type === 'email' ||
    (typeof e.placeholder === 'string' && /email|이메일|username/i.test(e.placeholder)) ||
    (typeof e.name === 'string' && /log.?in|sign.?in|로그인/i.test(e.name))
  )

  if (!isLoginPage) return

  console.log(`[Bot] 로그인 진행: ${account.username}`)

  const instaBtn = elements.find(e =>
    e.role === 'button' &&
    typeof e.name === 'string' &&
    (/continue with instagram/i.test(e.name) || e.name.includes(account.username))
  )

  if (instaBtn) {
    console.log(`[Bot] 인스타그램 계정 선택 클릭: ${account.username}`)
    await evaluate(tabId,
      `Array.from(document.querySelectorAll('[role=button]'))
        .find(e => e.textContent.includes('Continue with Instagram') || e.textContent.includes(${JSON.stringify(account.username)}))?.click()`
    )
  } else {
    const emailRef = await waitForRef(
      tabId,
      els => findRef(els,
        e => e.type === 'email',
        e => typeof e.placeholder === 'string' && /email|이메일|username/i.test(e.placeholder)
      ),
      10000
    )
    await fill(tabId, emailRef, account.loginEmail!)

    const elements2 = await snapshot(tabId)
    const passRef = findRef(elements2, e => e.type === 'password')
    if (!passRef) throw new Error('[Bot] 비밀번호 입력창을 찾을 수 없음')
    await fill(tabId, passRef, account.loginPassword!)

    const elements3 = await snapshot(tabId)
    const loginRef = findRef(
      elements3,
      e => e.type === 'submit',
      e => typeof e.name === 'string' && /log.?in|sign.?in|로그인/i.test(e.name)
    )
    if (!loginRef) throw new Error('[Bot] 로그인 버튼을 찾을 수 없음')
    await click(tabId, loginRef)
  }

  await waitForRef(
    tabId,
    els => {
      const stillOnLogin = els.some(e =>
        e.type === 'password' ||
        (e.role === 'button' && typeof e.name === 'string' && /continue with instagram/i.test(e.name))
      )
      return stillOnLogin ? null : 'done'
    },
    20000
  )
  console.log(`[Bot] 로그인 완료: ${account.username}`)
}

// ─── Publish Post ─────────────────────────────────────────────────────────────

export async function publishPost(post: ThreadPost): Promise<string | null> {
  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find(a => a.id === post.account)
  if (!account?.loginEmail) {
    console.error(`[Bot] 계정 로그인 정보 없음: ${post.account}`)
    return null
  }

  await ensureServer()
  const profileId = await ensureProfile(account.username)
  const instanceId = await startInstance(profileId)

  try {
    const tabId = await openTab(instanceId, 'https://www.threads.net')
    await ensureLoggedIn(tabId, account)

    await evaluate(tabId,
      `Array.from(document.querySelectorAll('div[role=button]'))
        .find(e => e.textContent.trim() === 'Create')?.click()`
    )

    const editorRef = await waitForRef(
      tabId,
      els => findRef(els, e => e.role === 'textbox'),
      10000
    )
    await typeText(tabId, editorRef, post.thread.main)

    await evaluate(tabId,
      `Array.from(document.querySelectorAll('[role=button]'))
        .find(e => e.textContent.trim() === '게시' || e.textContent.trim() === 'Post')?.click()`
    )

    await new Promise(resolve => setTimeout(resolve, 3000))

    const publishedUrl = await extractPublishedUrl(tabId, account.username)
    console.log(`[Bot] 발행 완료: ${post.id} → ${publishedUrl}`)
    return publishedUrl
  } catch (err) {
    console.error('[Bot] 발행 실패:', err)
    return null
  } finally {
    await stopInstance(instanceId).catch(() => {})
  }
}

async function extractPublishedUrl(tabId: string, username: string): Promise<string> {
  const elements = await snapshot(tabId)
  const postLink = elements.find(e =>
    typeof e.href === 'string' &&
    e.href.includes('/post/') &&
    e.href.includes(username)
  )
  if (postLink?.href) return postLink.href as string

  const href = await evaluate(tabId, `document.querySelector('a[href*="/post/"]')?.href`)
  if (typeof href === 'string' && href.includes('/post/')) return href

  return `https://www.threads.net/@${username}`
}

// ─── Publish Reply ────────────────────────────────────────────────────────────

export async function publishReply(post: ThreadPost, replyText: string): Promise<boolean> {
  if (!post.publishedUrl) {
    console.error(`[Bot] 발행된 URL 없음: ${post.id}`)
    return false
  }

  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find(a => a.id === post.account)
  if (!account?.loginEmail) {
    console.error(`[Bot] 계정 로그인 정보 없음: ${post.account}`)
    return false
  }

  await ensureServer()
  const profileId = await ensureProfile(account.username)
  const instanceId = await startInstance(profileId)

  try {
    const tabId = await openTab(instanceId, post.publishedUrl)
    await ensureLoggedIn(tabId, account)

    const replyRef = await waitForRef(
      tabId,
      els => findRef(els,
        e => e.role === 'textbox' && typeof e.placeholder === 'string' && /답글|reply/i.test(e.placeholder),
        e => e.role === 'textbox'
      ),
      15000
    )
    await typeText(tabId, replyRef, replyText)

    await evaluate(tabId,
      `Array.from(document.querySelectorAll('[role=button]'))
        .find(e => e.textContent.trim() === '게시' || e.textContent.trim() === 'Post')?.click()`
    )

    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log(`[Bot] 답글 완료: post ${post.id}, 내용: ${replyText.slice(0, 30)}...`)
    return true
  } catch (err) {
    console.error('[Bot] 답글 실패:', err)
    return false
  } finally {
    await stopInstance(instanceId).catch(() => {})
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit lib/threads-bot.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/threads-bot.ts
git commit -m "refactor(threads-bot): use instance lifecycle for Pinchtab isolation"
```

---

### Task 3: Update Tier 1 E2E Tests

**Files:**
- Modify: `__tests__/e2e/pinchtab-api.e2e.test.ts`

**Step 1: Rewrite Tier 1 tests for new API signatures**

All functions now require tabId as first argument. The test setup must create a profile, start instance, and open tab.

```typescript
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
```

**Step 2: Commit**

```bash
git add __tests__/e2e/pinchtab-api.e2e.test.ts
git commit -m "test(e2e): update Tier 1 tests for multi-instance API"
```

---

### Task 4: Fix Tier 2 E2E Tests — Minor Import Alignment

**Files:**
- Modify: `__tests__/e2e/threads-flow.e2e.test.ts`

**Step 1: Fix the dynamic imports**

The Tier 2 test is already written for the new API. Only 2 fixes needed:

1. Line 86-87: `fill` is already imported at top level but uses dynamic import — replace with direct call
2. Line 238: `navigate` uses dynamic import — replace with direct call
3. Line 266: `getText` uses dynamic import — replace with direct call

Add `fill`, `navigate`, `getText` to the top-level imports.

Change line 14-27 imports to:
```typescript
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
  evaluate,
  waitForRef,
  getText,
  type SnapElement,
} from '@/lib/pinchtab'
```

Replace line 86-87:
```typescript
    await fill(tabId, emailRef, TEST_EMAIL!)
    await fill(tabId, passRef, TEST_PASSWORD!)
```

Replace line 238-239:
```typescript
    await navigate(tabId, postLink.href as string)
```

Replace line 266-267:
```typescript
    const pageText = await getText(tabId)
```

**Step 2: Commit**

```bash
git add __tests__/e2e/threads-flow.e2e.test.ts
git commit -m "test(e2e): fix Tier 2 imports for multi-instance API"
```

---

### Task 5: TypeScript Full Build Verification

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: If errors, fix them and re-run**

**Step 3: Final commit if any fixes needed**

---

### Task 6: Delete Empty Legacy Files (Cleanup)

**Files:**
- Delete: `lib/browser.ts`
- Delete: `lib/sessions.ts`
- Delete: `lib/threads-login.ts`

**Step 1: Delete the 3 empty legacy files**

Run: `rm lib/browser.ts lib/sessions.ts lib/threads-login.ts`

**Step 2: Verify no imports reference them**

Run: `grep -r "browser\|sessions\|threads-login" lib/ app/ __tests__/ --include="*.ts" --include="*.tsx"`
Expected: No matches (or only unrelated matches)

**Step 3: Commit**

```bash
git add -u lib/browser.ts lib/sessions.ts lib/threads-login.ts
git commit -m "chore: remove empty legacy files (browser, sessions, threads-login)"
```

---

## Verification

1. **Type check:** `npx tsc --noEmit` — no errors
2. **Tier 1 E2E:** `npm run test:e2e:tier1` — requires Pinchtab server running
3. **Tier 2 E2E:** `npm run test:e2e:tier2` — requires Pinchtab server + env vars (THREADS_TEST_ACCOUNT, THREADS_TEST_EMAIL, THREADS_TEST_PASSWORD)
4. **Dev server:** `npm run dev` — should start without issues (pages don't use pinchtab directly)
