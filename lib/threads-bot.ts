import type { Account, ThreadPost } from './types'
import { launchBrowser, newStealthContext, randomDelay, humanType } from './browser'
import { loadSession, saveSession, clearSession } from './sessions'
import { loginDirect, loginGoogle } from './threads-login'
import { readStore } from './store'

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

  const result = await ensureLoggedIn(account)
  if (!result) {
    console.error(`[Bot] 로그인 실패: ${account.username}`)
    return false
  }

  const { ctx, browser } = result
  const page = await ctx.newPage()
  let success = false

  try {
    // 발행된 포스트 URL로 이동
    await page.goto(post.publishedUrl, { waitUntil: 'networkidle' })
    await randomDelay(1500, 3000)

    // 답글 버튼 클릭
    const replyBtn = page.locator('[aria-label*="답글"], [aria-label*="Reply"], [aria-label*="reply"]').first()
    await replyBtn.click()
    await randomDelay(800, 1500)

    // 댓글 입력창
    const editor = page.locator('[contenteditable="true"], textarea').first()
    await editor.click()
    await randomDelay(300, 700)
    await humanType(page, replyText)
    await randomDelay(1000, 2000)

    // 게시 버튼
    const postBtn = page.locator('button:has-text("게시"), button:has-text("Post")').first()
    await postBtn.click()
    await randomDelay(2000, 4000)

    // 쿠키 업데이트
    const updatedCookies = await ctx.cookies()
    saveSession(account.id, updatedCookies)

    success = true
    console.log(`[Bot] 답글 완료: post ${post.id}, 내용: ${replyText.slice(0, 30)}...`)
  } catch (err) {
    console.error('[Bot] 답글 실패:', err)
  } finally {
    await page.close()
    await browser.close()
  }

  return success
}
