import { spawn } from 'child_process'

const BASE = process.env.PINCHTAB_URL ?? 'http://127.0.0.1:9867'

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

  // 최대 10초 대기
  for (let i = 0; i < 20; i++) {
    await delay(500)
    if (await isServerRunning()) {
      console.log('[Pinchtab] 서버 준비 완료')
      return
    }
  }
  throw new Error('[Pinchtab] 서버 시작 실패 (10초 초과)')
}

// ─── Internal Helper ──────────────────────────────────────────────────────────

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

// ─── Profiles ─────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  name: string
}

export async function ensureProfile(name: string): Promise<string> {
  const profiles = await api<Profile[]>('GET', '/profiles')
  const existing = profiles.find(p => p.name === name)
  if (existing) return existing.id

  const created = await api<Profile>('POST', '/profiles', { name })
  return created.id
}

// ─── Instances ────────────────────────────────────────────────────────────────

interface Instance {
  id: string
}

export async function startInstance(profileId: string, headed = false): Promise<string> {
  const inst = await api<Instance>('POST', '/instances/start', {
    profileId,
    mode: headed ? 'headed' : 'headless',
  })
  return inst.id
}

export async function stopInstance(instanceId: string): Promise<void> {
  await fetch(`${BASE}/instances/${instanceId}/stop`, { method: 'POST' }).catch(() => {})
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface Tab {
  id: string
}

export async function openTab(instanceId: string, url: string): Promise<string> {
  const tab = await api<Tab>('POST', '/tabs/new', { instanceId, url })
  return tab.id
}

export async function navigate(tabId: string, url: string): Promise<void> {
  await api('POST', `/tabs/${tabId}/navigate`, { url })
}

// ─── Snapshot / Elements ──────────────────────────────────────────────────────

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
  const res = await fetch(
    `${BASE}/tabs/${tabId}/snapshot?filter=interactive&compact=true`
  )
  if (!res.ok) throw new Error(`[Pinchtab] snapshot → ${res.status}`)
  const data = await res.json() as { elements?: SnapElement[] } | SnapElement[]
  // API가 { elements: [...] } 또는 [...] 형태로 반환할 수 있음
  return Array.isArray(data) ? data : (data.elements ?? [])
}

// ─── Actions ──────────────────────────────────────────────────────────────────

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
  throw new Error(`[Pinchtab] waitForRef timeout (${timeoutMs}ms)`)
}

// ─── Text ─────────────────────────────────────────────────────────────────────

export async function getText(tabId: string): Promise<string> {
  const res = await fetch(`${BASE}/tabs/${tabId}/text`)
  if (!res.ok) throw new Error(`[Pinchtab] getText → ${res.status}`)
  const data = await res.json() as { text?: string } | string
  return typeof data === 'string' ? data : (data.text ?? '')
}

// ─── Cookies ──────────────────────────────────────────────────────────────────

export async function getCookies(tabId: string): Promise<object[]> {
  return api<object[]>('GET', `/tabs/${tabId}/cookies`)
}

export async function setCookies(tabId: string, cookies: object[]): Promise<void> {
  await api('POST', `/tabs/${tabId}/cookies`, cookies)
}
