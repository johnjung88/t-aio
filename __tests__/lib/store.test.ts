// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

let tempDir: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

// Dynamic import so each test gets the store with the mocked cwd
async function getStore() {
  vi.resetModules()
  const mod = await import('@/lib/store')
  return { readStore: mod.readStore, writeStore: mod.writeStore }
}

describe('readStore', () => {
  it('파일이 없을 때 기본값을 반환한다', async () => {
    const { readStore } = await getStore()
    const result = readStore('missing', [])
    expect(result).toEqual([])
  })

  it('파일이 없을 때 기본값을 파일로 저장한다', async () => {
    const { readStore } = await getStore()
    readStore('init', { key: 'value' })
    const filePath = path.join(tempDir, 'data', 'init.json')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('기존 데이터를 정상적으로 읽는다', async () => {
    const dataDir = path.join(tempDir, 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(path.join(dataDir, 'posts.json'), JSON.stringify([{ id: '1' }], null, 2))

    const { readStore } = await getStore()
    const result = readStore<{ id: string }[]>('posts', [])
    expect(result).toEqual([{ id: '1' }])
  })

  it('JSON 파싱 실패 시 기본값을 반환한다', async () => {
    const dataDir = path.join(tempDir, 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(path.join(dataDir, 'broken.json'), 'not valid json')

    const { readStore } = await getStore()
    const result = readStore('broken', 'fallback')
    expect(result).toBe('fallback')
  })
})

describe('writeStore', () => {
  it('데이터를 파일에 쓴다', async () => {
    const { writeStore } = await getStore()
    writeStore('items', [{ id: 'a' }])

    const filePath = path.join(tempDir, 'data', 'items.json')
    const raw = fs.readFileSync(filePath, 'utf-8')
    expect(JSON.parse(raw)).toEqual([{ id: 'a' }])
  })

  it('기존 파일을 덮어쓴다', async () => {
    const { writeStore, readStore } = await getStore()
    writeStore('items', [{ id: 'old' }])
    writeStore('items', [{ id: 'new' }])

    const result = readStore<{ id: string }[]>('items', [])
    expect(result).toEqual([{ id: 'new' }])
  })
})
