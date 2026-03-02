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
