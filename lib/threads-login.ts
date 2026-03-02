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

export async function loginGoogle(
  ctx: BrowserContext,
  googleEmail: string,
  password: string
): Promise<boolean> {
  const page = await ctx.newPage()
  try {
    await page.goto('https://www.threads.net/login', { waitUntil: 'networkidle' })
    await randomDelay(1000, 2000)

    // "Google로 계속하기" 버튼
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
