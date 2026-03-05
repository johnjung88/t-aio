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

  await api<{ status: string; name: string }>('POST', '/profiles', { name })
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
