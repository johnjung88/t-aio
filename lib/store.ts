import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function readStore<T>(name: string, defaultValue: T): T {
  ensureDataDir()
  const fp = path.join(DATA_DIR, `${name}.json`)
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(fp, JSON.stringify(defaultValue, null, 2))
    return defaultValue
  }
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T
  } catch {
    return defaultValue
  }
}

export function writeStore<T>(name: string, data: T): void {
  ensureDataDir()
  fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2))
}
