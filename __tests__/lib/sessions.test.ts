// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

let tempDir: string
beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sessions-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir)
  vi.resetModules()
})
afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

async function getSessions() {
  const mod = await import('@/lib/sessions')
  return mod
}

describe('loadSession', () => {
  it('세션 파일 없으면 null 반환', async () => {
    const { loadSession } = await getSessions()
    expect(loadSession('acc1')).toBeNull()
  })

  it('저장된 쿠키 반환', async () => {
    const { saveSession, loadSession } = await getSessions()
    saveSession('acc1', [{ name: 'token', value: 'abc', domain: '.threads.net' }] as never)
    const cookies = loadSession('acc1')
    expect(cookies).not.toBeNull()
    expect(cookies![0].name).toBe('token')
  })
})

describe('clearSession', () => {
  it('세션 파일 삭제', async () => {
    const { saveSession, clearSession, loadSession } = await getSessions()
    saveSession('acc1', [] as never)
    clearSession('acc1')
    expect(loadSession('acc1')).toBeNull()
  })
})
