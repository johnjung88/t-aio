import { chromium, Browser, BrowserContext, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

// ─── State ────────────────────────────────────────────────────────────────────

let browser: Browser | null = null
const contexts = new Map<string, BrowserContext>()
const pages = new Map<string, Page>()
let tabSeq = 0

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function sessionPath(profileName: string): string {
  const dir = path.join(process.cwd(), 'data', 'sessions')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${profileName}.json`)
}

// ─── Browser / Context ───────────────────────────────────────────────────────

async function getBrowser(): Promise<Browser> {
  if (!browser?.isConnected()) {
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    })
  }
  return browser
}

async function getContext(profileName: string): Promise<BrowserContext> {
  const existing = contexts.get(profileName)
  if (existing) return existing

  const b = await getBrowser()
  const sp = sessionPath(profileName)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let storageState: any
  if (fs.existsSync(sp)) {
    try { storageState = JSON.parse(fs.readFileSync(sp, 'utf-8')) } catch {}
  }

  const ctx = await b.newContext({
    storageState,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })

  // 페이지 로드 전 anti-detection 주입
  await ctx.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
    if (!navigator.userAgentData) {
      Object.defineProperty(navigator, 'userAgentData', {
        get: () => ({
          brands: [{ brand: 'Chromium', version: '120' }, { brand: 'Google Chrome', version: '120' }],
          mobile: false, platform: 'Windows',
        }),
        configurable: true,
      });
    }
  `)

  contexts.set(profileName, ctx)
  return ctx
}

// ─── Server Management (no-op — Playwright is embedded) ──────────────────────

export async function ensureServer(): Promise<void> {}

// ─── Profiles / Instances ────────────────────────────────────────────────────

export async function ensureProfile(name: string): Promise<string> {
  return name
}

export async function startInstance(profileName: string): Promise<string> {
  await getContext(profileName)
  return profileName
}

export async function stopInstance(instanceId: string): Promise<void> {
  const ctx = contexts.get(instanceId)
  if (!ctx) return
  try {
    const state = await ctx.storageState()
    fs.writeFileSync(sessionPath(instanceId), JSON.stringify(state))
  } catch {}
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export async function openTab(instanceId: string, url?: string): Promise<string> {
  const ctx = await getContext(instanceId)
  const page = await ctx.newPage()
  const tabId = `tab_${++tabSeq}`
  pages.set(tabId, page)

  if (url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await delay(2000)
  }

  return tabId
}

export async function closeTab(tabId: string): Promise<void> {
  const page = pages.get(tabId)
  if (page) {
    await page.close().catch(() => {})
    pages.delete(tabId)
  }
}

export async function navigate(tabId: string, url: string): Promise<void> {
  const page = pages.get(tabId)
  if (!page) throw new Error(`[Playwright] Tab not found: ${tabId}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
}

// ─── Snapshot / Elements ─────────────────────────────────────────────────────

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
  const page = pages.get(tabId)
  if (!page) throw new Error(`[Playwright] Tab not found: ${tabId}`)

  return page.evaluate(() => {
    const selector = [
      'a[href]', 'button', 'input', 'textarea', 'select',
      '[role="button"]', '[role="textbox"]', '[role="link"]',
      '[role="checkbox"]', '[role="radio"]', '[role="combobox"]',
    ].join(',')

    const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
    return els.map((el, i) => {
      const ref = `e${i + 1}`
      el.dataset.ptref = ref
      const tag = el.tagName.toLowerCase()
      const role = el.getAttribute('role')
        ?? (tag === 'a' ? 'link' : tag === 'button' ? 'button' : (tag === 'input' || tag === 'textarea') ? 'textbox' : undefined)
      return {
        ref,
        role,
        name: (el.getAttribute('aria-label') || el.innerText?.trim())?.slice(0, 100),
        tag,
        type: (el as HTMLInputElement).type || undefined,
        text: el.innerText?.trim()?.slice(0, 200),
        placeholder: (el as HTMLInputElement).placeholder || undefined,
        href: (el as HTMLAnchorElement).href || undefined,
        disabled: (el as HTMLButtonElement).disabled || undefined,
        checked: (el as HTMLInputElement).checked ?? undefined,
      }
    })
  }) as Promise<SnapElement[]>
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function click(tabId: string, ref: string): Promise<void> {
  const page = pages.get(tabId)
  if (!page) throw new Error(`[Playwright] Tab not found: ${tabId}`)
  await page.locator(`[data-ptref="${ref}"]`).click({ timeout: 10000 })
}

export async function fill(tabId: string, ref: string, text: string): Promise<void> {
  const page = pages.get(tabId)
  if (!page) throw new Error(`[Playwright] Tab not found: ${tabId}`)
  await page.locator(`[data-ptref="${ref}"]`).fill(text, { timeout: 10000 })
}

export async function type(tabId: string, ref: string, text: string): Promise<void> {
  const page = pages.get(tabId)
  if (!page) throw new Error(`[Playwright] Tab not found: ${tabId}`)
  await page.locator(`[data-ptref="${ref}"]`).pressSequentially(text, { delay: 50 })
}

export async function press(tabId: string, key: string): Promise<void> {
  const page = pages.get(tabId)
  if (!page) throw new Error(`[Playwright] Tab not found: ${tabId}`)
  await page.keyboard.press(key)
}

// ─── Wait Helpers ─────────────────────────────────────────────────────────────

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
  throw new Error(`[Playwright] waitForRef timeout (${timeoutMs}ms)`)
}

// ─── Evaluate ─────────────────────────────────────────────────────────────────

export async function evaluate(tabId: string, expression: string): Promise<unknown> {
  const page = pages.get(tabId)
  if (!page) throw new Error(`[Playwright] Tab not found: ${tabId}`)
  return page.evaluate(expression)
}

export async function getText(tabId: string): Promise<string> {
  const page = pages.get(tabId)
  if (!page) throw new Error(`[Playwright] Tab not found: ${tabId}`)
  return page.innerText('body').catch(() => '')
}
