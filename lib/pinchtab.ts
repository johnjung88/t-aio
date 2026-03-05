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

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface TabInfo {
  id: string
  url: string
  title: string
}

export async function getTabId(): Promise<string> {
  const data = await api<{ tabs: TabInfo[] }>('GET', '/tabs')
  const tab = data.tabs?.[0]
  if (!tab) throw new Error('[Pinchtab] 열린 탭 없음')
  return tab.id
}

export async function navigate(tabId: string, url: string): Promise<void> {
  await api('POST', '/navigate', { tabId, url })
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

export async function snapshot(): Promise<SnapElement[]> {
  const res = await fetch(`${BASE}/snapshot?filter=interactive&compact=true`)
  if (!res.ok) throw new Error(`[Pinchtab] snapshot → ${res.status}`)
  const data = await res.json() as { nodes?: SnapElement[]; elements?: SnapElement[] } | SnapElement[]
  // API가 { nodes: [...] } 또는 { elements: [...] } 또는 [...] 형태로 반환
  if (Array.isArray(data)) return data
  return data.nodes ?? data.elements ?? []
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function click(ref: string): Promise<void> {
  await api('POST', '/action', { kind: 'click', ref })
}

export async function fill(ref: string, text: string): Promise<void> {
  await api('POST', '/action', { kind: 'fill', ref, text })
}

export async function type(ref: string, text: string): Promise<void> {
  await api('POST', '/action', { kind: 'type', ref, text })
}

export async function press(key: string): Promise<void> {
  await api('POST', '/action', { kind: 'press', ref: 'keyboard', text: key })
}

// ─── Wait Helpers ─────────────────────────────────────────────────────────────

export async function waitForRef(
  matcher: (elements: SnapElement[]) => string | null,
  timeoutMs = 15000
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const elements = await snapshot()
    const ref = matcher(elements)
    if (ref) return ref
    await delay(800)
  }
  throw new Error(`[Pinchtab] waitForRef timeout (${timeoutMs}ms)`)
}

// ─── Evaluate ────────────────────────────────────────────────────────────────

export async function evaluate(expression: string): Promise<unknown> {
  const res = await api<{ result?: unknown; error?: string }>('POST', '/evaluate', { expression })
  if (res.error) throw new Error(`[Pinchtab] evaluate error: ${res.error}`)
  return res.result
}
