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
