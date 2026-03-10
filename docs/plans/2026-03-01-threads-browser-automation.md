# Threads 브라우저 자동화 구현 플랜

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Playwright로 Threads 웹에서 포스트/댓글을 자동 발행하되, 봇 탐지를 피하는 사람처럼 보이는 동작 구현

**Architecture:**
`lib/threads-bot.ts`가 세션 관리(쿠키 저장/복원) + 봇 탐지 회피 + 포스팅을 담당.
`lib/threads-login.ts`가 직접 로그인(이메일+비번 타이핑) / 구글 연동 로그인 두 경로를 처리.
`lib/scheduler.ts`의 `runAutoGen()`에서 draft 저장 후 `publishPost()`를 호출해 실제 발행.

**Tech Stack:** playwright, 기존 lib/store.ts(세션 쿠키 저장), lib/types.ts(Account 확장)

---

## 설계 결정

### 계정 로그인 정보 저장
`Account` 타입에 추가:
```typescript
loginMethod: 'direct' | 'google'
loginEmail?: string      // 직접: Threads 이메일, 구글: Gmail 주소
loginPassword?: string   // 직접 로그인 시 (로컬 서버 전용)
```

### 세션 저장 위치
`data/sessions/{accountId}.json` — Playwright 쿠키 배열
서버 재시작 후에도 로그인 상태 유지.

### 봇 탐지 회피 전략
1. `navigator.webdriver` 플래그 제거 (`addInitScript`)
2. 실제 브라우저 UA + 1920×1080 뷰포트
3. `keyboard.type(text, { delay: 80~180ms 랜덤 })` 타이핑
4. 클릭 전 50~200ms 대기
5. 액션 사이 500~2000ms 랜덤 대기
6. 포스트 후 피드 잠깐 스크롤

---

## Task 1: Account 타입에 로그인 정보 추가

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/schemas.ts`

**Step 1: `lib/types.ts` Account 인터페이스에 필드 추가**

```typescript
// Account 인터페이스 기존 필드 뒤에 추가
loginMethod: 'direct' | 'google'
loginEmail?: string
loginPassword?: string
```

**Step 2: `lib/schemas.ts` accountCreateBodySchema에 필드 추가**

```typescript
// accountCreateBodySchema에 추가
loginMethod: z.enum(['direct', 'google'] as const).optional(),
loginEmail: z.string().email().optional(),
loginPassword: z.string().optional(),
```

`accountPatchSchema`에도 동일하게 추가.

**Step 3: `app/api/accounts/route.ts` POST 핸들러에서 신규 필드 반영**

```typescript
const newAccount: Account = {
  // ...기존 필드...
  loginMethod: body.loginMethod ?? 'direct',
  loginEmail: body.loginEmail,
  loginPassword: body.loginPassword,
}
```

**Step 4: 기존 테스트 통과 확인**

```bash
npm run test:run
```
Expected: 모든 테스트 통과 (타입 변경이므로 기존 테스트 영향 없음)

**Step 5: Commit**

```bash
git add lib/types.ts lib/schemas.ts app/api/accounts/route.ts
git commit -m "feat: Account 타입에 로그인 정보 필드 추가 (loginMethod/loginEmail/loginPassword)"
```

---

## Task 2: Playwright 설치 + 봇 회피 유틸리티

**Files:**
- Create: `lib/browser.ts`

**Step 1: Playwright 설치**

```bash
npm install playwright
npx playwright install chromium
```

**Step 2: `lib/browser.ts` 작성**

봇 탐지 회피 설정 + 랜덤 딜레이 유틸:

```typescript
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  })
}

export async function newStealthContext(browser: Browser, cookies?: object[]): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  })
  // webdriver 플래그 제거
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
  if (cookies?.length) await ctx.addCookies(cookies as never)
  return ctx
}

export function randomDelay(minMs = 500, maxMs = 2000): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs) + minMs)
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function humanType(page: Page, text: string): Promise<void> {
  for (const char of text) {
    await page.keyboard.type(char, { delay: Math.floor(Math.random() * 100 + 80) })
  }
}
```

**Step 3: 빌드 에러 없는지 확인**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add lib/browser.ts package.json package-lock.json
git commit -m "feat: Playwright 설치 + 봇 탐지 회피 브라우저 유틸리티"
```

---

## Task 3: 세션 관리 (쿠키 저장/복원)

**Files:**
- Create: `lib/sessions.ts`
- Create: `__tests__/lib/sessions.test.ts`

**Step 1: 테스트 작성**

`__tests__/lib/sessions.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

let tempDir: string
beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sessions-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir)
  vi.resetModules()
})
afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

async function getSessions() {
  const mod = await import('@/lib/sessions')
  return mod
}

describe('loadSession', () => {
  it('세션 파일 없으면 null 반환', async () => {
    const { loadSession } = await getSessions()
    expect(loadSession('acc1')).toBeNull()
  })

  it('저장된 쿠키 반환', async () => {
    const { saveSession, loadSession } = await getSessions()
    saveSession('acc1', [{ name: 'token', value: 'abc', domain: '.threads.net' }] as never)
    const cookies = loadSession('acc1')
    expect(cookies).not.toBeNull()
    expect(cookies![0].name).toBe('token')
  })
})

describe('clearSession', () => {
  it('세션 파일 삭제', async () => {
    const { saveSession, clearSession, loadSession } = await getSessions()
    saveSession('acc1', [] as never)
    clearSession('acc1')
    expect(loadSession('acc1')).toBeNull()
  })
})
```

**Step 2: 테스트 실패 확인**

```bash
npm run test:run -- __tests__/lib/sessions.test.ts
```
Expected: FAIL (모듈 없음)

**Step 3: `lib/sessions.ts` 구현**

```typescript
import fs from 'fs'
import path from 'path'

const SESSIONS_DIR = () => path.join(process.cwd(), 'data', 'sessions')

function ensureDir() {
  fs.mkdirSync(SESSIONS_DIR(), { recursive: true })
}

export function loadSession(accountId: string): object[] | null {
  ensureDir()
  const fp = path.join(SESSIONS_DIR(), `${accountId}.json`)
  if (!fs.existsSync(fp)) return null
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8')) as object[]
  } catch {
    return null
  }
}

export function saveSession(accountId: string, cookies: object[]): void {
  ensureDir()
  fs.writeFileSync(
    path.join(SESSIONS_DIR(), `${accountId}.json`),
    JSON.stringify(cookies, null, 2)
  )
}

export function clearSession(accountId: string): void {
  const fp = path.join(SESSIONS_DIR(), `${accountId}.json`)
  if (fs.existsSync(fp)) fs.unlinkSync(fp)
}
```

**Step 4: 테스트 통과 확인**

```bash
npm run test:run -- __tests__/lib/sessions.test.ts
```
Expected: 3 tests passed

**Step 5: Commit**

```bash
git add lib/sessions.ts __tests__/lib/sessions.test.ts
git commit -m "feat: Threads 세션 쿠키 저장/복원 (data/sessions/{accountId}.json)"
```

---

## Task 4: 직접 로그인 (이메일 + 비밀번호 타이핑)

**Files:**
- Create: `lib/threads-login.ts`

**Step 1: `lib/threads-login.ts` — 직접 로그인 함수**

```typescript
import type { BrowserContext } from 'playwright'
import { randomDelay, humanType } from './browser'

export async function loginDirect(
  ctx: BrowserContext,
  email: string,
  password: string
): Promise<boolean> {
  const page = await ctx.newPage()
  try {
    await page.goto('https://www.threads.net/login', { waitUntil: 'networkidle' })
    await randomDelay(1000, 2000)

    // 이메일 입력
    const emailInput = page.locator('input[autocomplete="username"], input[type="text"]').first()
    await emailInput.click()
    await randomDelay(300, 700)
    await humanType(page, email)
    await randomDelay(500, 1000)

    // 비밀번호 입력
    const pwInput = page.locator('input[type="password"]').first()
    await pwInput.click()
    await randomDelay(300, 700)
    await humanType(page, password)
    await randomDelay(500, 1000)

    // 로그인 버튼 클릭
    const loginBtn = page.locator('button[type="submit"]').first()
    await loginBtn.click()
    await randomDelay(2000, 4000)

    // 로그인 성공 확인 (피드 또는 홈으로 이동)
    const url = page.url()
    return url.includes('threads.net') && !url.includes('/login')
  } finally {
    await page.close()
  }
}
```

**Step 2: `lib/threads-login.ts` — 구글 로그인 함수 추가**

```typescript
export async function loginGoogle(
  ctx: BrowserContext,
  googleEmail: string,
  password: string
): Promise<boolean> {
  const page = await ctx.newPage()
  try {
    await page.goto('https://www.threads.net/login', { waitUntil: 'networkidle' })
    await randomDelay(1000, 2000)

    // "Instagram으로 로그인" 또는 "Google로 계속하기" 버튼
    const googleBtn = page.locator('text=Google로 계속, text=Continue with Google').first()
    await googleBtn.click()
    await randomDelay(2000, 3000)

    // 구글 계정 선택 or 이메일 입력
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible()) {
      await humanType(page, googleEmail)
      await page.keyboard.press('Enter')
      await randomDelay(1500, 2500)
    }

    // 비밀번호 입력
    const pwInput = page.locator('input[type="password"]')
    if (await pwInput.isVisible()) {
      await humanType(page, password)
      await page.keyboard.press('Enter')
      await randomDelay(2000, 4000)
    }

    const url = page.url()
    return url.includes('threads.net') && !url.includes('/login')
  } finally {
    await page.close()
  }
}
```

**Step 3: 빌드 확인**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add lib/threads-login.ts
git commit -m "feat: Threads 직접/구글 로그인 자동화 (humanType, 랜덤 딜레이)"
```

---

## Task 5: 포스트 발행 + 세션 통합

**Files:**
- Create: `lib/threads-bot.ts`

**Step 1: `lib/threads-bot.ts` 작성**

메인 로직: 세션 복원 → 로그인 확인 → 포스트 발행

```typescript
import type { Account, ThreadPost } from './types'
import { launchBrowser, newStealthContext, randomDelay, humanType } from './browser'
import { loadSession, saveSession, clearSession } from './sessions'
import { loginDirect, loginGoogle } from './threads-login'
import { readStore, writeStore } from './store'

async function ensureLoggedIn(account: Account): Promise<{ ctx: import('playwright').BrowserContext; browser: import('playwright').Browser } | null> {
  const browser = await launchBrowser()
  const cookies = loadSession(account.id)
  const ctx = await newStealthContext(browser, cookies ?? undefined)

  // 세션 유효성 확인
  if (cookies) {
    const page = await ctx.newPage()
    await page.goto('https://www.threads.net', { waitUntil: 'networkidle' })
    await randomDelay(1000, 2000)
    const url = page.url()
    await page.close()
    if (!url.includes('/login')) return { ctx, browser }
    // 세션 만료 — 재로그인
    clearSession(account.id)
  }

  // 로그인
  const success = account.loginMethod === 'google'
    ? await loginGoogle(ctx, account.loginEmail!, account.loginPassword!)
    : await loginDirect(ctx, account.loginEmail!, account.loginPassword!)

  if (!success) {
    await browser.close()
    return null
  }

  // 새 쿠키 저장
  const newCookies = await ctx.cookies()
  saveSession(account.id, newCookies)
  return { ctx, browser }
}

export async function publishPost(post: ThreadPost): Promise<string | null> {
  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find(a => a.id === post.account)
  if (!account?.loginEmail) {
    console.error(`[Bot] 계정 로그인 정보 없음: ${post.account}`)
    return null
  }

  const result = await ensureLoggedIn(account)
  if (!result) {
    console.error(`[Bot] 로그인 실패: ${account.username}`)
    return null
  }

  const { ctx, browser } = result
  const page = await ctx.newPage()
  let publishedUrl: string | null = null

  try {
    await page.goto('https://www.threads.net', { waitUntil: 'networkidle' })
    await randomDelay(1000, 2000)

    // 새 스레드 작성 버튼
    const newPostBtn = page.locator('a[href="/intent/post"], [aria-label*="스레드"], [aria-label*="thread"]').first()
    await newPostBtn.click()
    await randomDelay(800, 1500)

    // 본문 입력
    const editor = page.locator('[contenteditable="true"], textarea').first()
    await editor.click()
    await randomDelay(300, 700)
    await humanType(page, post.thread.main)
    await randomDelay(1000, 2000)

    // 게시 버튼
    const postBtn = page.locator('button:has-text("게시"), button:has-text("Post")').first()
    await postBtn.click()
    await randomDelay(2000, 4000)

    // 발행된 URL 추출
    publishedUrl = page.url()

    // 피드 잠깐 스크롤 (봇 회피)
    await page.mouse.wheel(0, 300)
    await randomDelay(1000, 2000)
    await page.mouse.wheel(0, -300)
    await randomDelay(500, 1000)

    // 쿠키 업데이트
    const updatedCookies = await ctx.cookies()
    saveSession(account.id, updatedCookies)

    console.log(`[Bot] 발행 완료: ${post.id} → ${publishedUrl}`)
  } catch (err) {
    console.error('[Bot] 발행 실패:', err)
    publishedUrl = null
  } finally {
    await page.close()
    await browser.close()
  }

  return publishedUrl
}

export async function publishReply(post: ThreadPost, replyText: string): Promise<void> {
  // TODO: 발행된 포스트 URL로 이동 → 댓글 달기 구현
  // publishedUrl 기반으로 reply 포스팅
  console.log(`[Bot] 댓글 예약됨: post ${post.id}, 내용: ${replyText.slice(0, 30)}...`)
}
```

**Step 2: `lib/scheduler.ts`에서 `publishPost` 호출**

`runAutoGen()` 함수에서 `writeStore('posts', posts)` 이후 발행 연동 추가:

```typescript
// 기존 writeStore('posts', posts) 이후에 추가
import { publishPost } from './threads-bot'

// ...
posts.push(newPost)
writeStore('posts', posts)

// Threads 발행
const publishedUrl = await publishPost(newPost)
if (publishedUrl) {
  const postIdx = posts.findIndex(p => p.id === newPost.id)
  if (postIdx !== -1) {
    posts[postIdx].status = 'published'
    posts[postIdx].publishedAt = new Date().toISOString()
    posts[postIdx].publishedUrl = publishedUrl
    posts[postIdx].updatedAt = new Date().toISOString()
    writeStore('posts', posts)
  }
}
```

**Step 3: 빌드 확인**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add lib/threads-bot.ts lib/scheduler.ts
git commit -m "feat: Threads 브라우저 자동 발행 구현 (세션 복원, 봇 탐지 회피)"
```

---

## Task 6: `.gitignore` + `.env.example` 업데이트

**Files:**
- Modify: `.gitignore`
- Modify: `.env.example`

**Step 1: `.gitignore`에 세션 디렉토리 추가**

```
# 기존 내용에 추가
data/sessions/
```

**Step 2: `.env.example` 업데이트 (참고용 주석 추가)**

```
# 계정 로그인 정보는 /api/accounts POST로 등록
# loginMethod: 'direct' | 'google'
# loginEmail: Threads 이메일 or Gmail 주소
# loginPassword: 비밀번호 (서버 로컬 전용)
```

**Step 3: Commit**

```bash
git add .gitignore .env.example
git commit -m "chore: sessions 디렉토리 gitignore, env.example 로그인 안내 추가"
```

---

## Task 7: 전체 검증 + 최종 커밋

**Step 1: 전체 테스트 통과**

```bash
npm run test:run
```
Expected: 모든 테스트 통과 (sessions 테스트 포함)

**Step 2: 빌드 통과**

```bash
npm run build
```

**Step 3: 린트 통과**

```bash
npm run lint
```

**Step 4: 수동 검증 체크리스트**

- [ ] 계정 등록 API에서 `loginMethod`, `loginEmail`, `loginPassword` 저장 확인
- [ ] `data/sessions/` 디렉토리 자동 생성 확인
- [ ] `npm run dev` 후 대시보드 정상 동작 확인

**Step 5: 최종 커밋 + 푸시**

```bash
git add -A
git commit -m "feat: Threads 브라우저 자동화 완성 (로그인/세션/발행 파이프라인)"
git push origin <branch>
```

---

## 검증 방법 요약

| 명령 | 기대 결과 |
|------|-----------|
| `npm run test:run` | 전체 통과 (sessions 포함) |
| `npm run build` | 빌드 에러 없음 |
| `npm run lint` | 린트 에러 없음 |
| API: `POST /api/accounts` with `loginEmail` | Account에 로그인 정보 저장 |
| 스케줄러 수동 트리거 | Threads 브라우저 열려서 포스팅 |

## 주의사항

- **Threads UI 변경 대응**: 셀렉터가 바뀔 수 있으므로 `aria-label` + `text` 복수 셀렉터 사용
- **headless: false**: 서버PC에 모니터 없으면 `headless: true`로 변경, 단 탐지 위험 높아짐
- **loginPassword 보안**: 로컬 서버 전용. 외부 접근 가능 환경에서는 암호화 필요
