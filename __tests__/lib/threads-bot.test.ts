// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SnapElement } from '@/lib/pinchtab'
import type { Account, ThreadPost } from '@/lib/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/store', () => ({
  readStore: vi.fn(),
}))

vi.mock('@/lib/pinchtab', () => ({
  ensureServer: vi.fn(),
  getTabId: vi.fn(),
  navigate: vi.fn(),
  snapshot: vi.fn(),
  click: vi.fn(),
  fill: vi.fn(),
  type: vi.fn(),
  evaluate: vi.fn(),
  waitForRef: vi.fn(),
}))

import { readStore } from '@/lib/store'
import {
  ensureServer,
  getTabId,
  navigate,
  snapshot,
  click,
  fill,
  type as typeAction,
  evaluate,
  waitForRef,
} from '@/lib/pinchtab'

import { publishPost, publishReply } from '@/lib/threads-bot'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LOGGED_IN_HOME: SnapElement[] = [
  { ref: 'home-link', role: 'link', name: '홈' },
  { ref: 'search-link', role: 'link', name: '검색' },
  { ref: 'profile-link', role: 'link', name: '프로필' },
]

const LOGIN_PAGE: SnapElement[] = [
  { ref: 'email-input', type: 'email', placeholder: 'Email address' },
  { ref: 'pass-input', type: 'password', placeholder: 'Password' },
  { ref: 'submit-btn', type: 'submit', name: 'Log in' },
]

const INSTA_LOGIN_PAGE: SnapElement[] = [
  { ref: 'insta-btn', role: 'button', name: 'Instagram Continue with Instagram testuser Log in' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc1',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    username: 'testuser',
    displayName: 'Test User',
    niche: 'tech',
    timezone: 'Asia/Seoul',
    dailyPostTarget: 3,
    autoGenEnabled: false,
    autoGenTime: '09:00',
    categories: [],
    todayPostCount: 0,
    todayPostDate: '2024-01-01',
    loginMethod: 'direct',
    loginEmail: 'test@example.com',
    loginPassword: 'password123',
    ...overrides,
  }
}

function makePost(overrides: Partial<ThreadPost> = {}): ThreadPost {
  return {
    id: 'post1',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    status: 'scheduled',
    contentType: 'informational',
    topic: 'AI',
    keywords: [],
    account: 'acc1',
    thread: { main: '테스트 포스트 내용입니다.' },
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  vi.mocked(ensureServer).mockResolvedValue(undefined)
  vi.mocked(getTabId).mockResolvedValue('tab1')
  vi.mocked(navigate).mockResolvedValue(undefined)
  vi.mocked(click).mockResolvedValue(undefined)
  vi.mocked(fill).mockResolvedValue(undefined)
  vi.mocked(typeAction).mockResolvedValue(undefined)
  vi.mocked(evaluate).mockResolvedValue(undefined)
})

// ── publishPost ───────────────────────────────────────────────────────────────

describe('publishPost', () => {
  it('계정 없음 → null 반환', async () => {
    vi.mocked(readStore).mockReturnValue([])

    const result = await publishPost(makePost())

    expect(result).toBeNull()
    expect(ensureServer).not.toHaveBeenCalled()
  })

  it('loginEmail 없음 → null 반환', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount({ loginEmail: undefined })])

    const result = await publishPost(makePost())

    expect(result).toBeNull()
    expect(ensureServer).not.toHaveBeenCalled()
  })

  it('이미 로그인 상태에서 전체 성공 플로우 → URL 반환', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])
    vi.mocked(snapshot)
      .mockResolvedValueOnce(LOGGED_IN_HOME)  // ensureLoggedIn: 이미 로그인
      .mockResolvedValueOnce([])              // extractPublishedUrl: snapshot에 link 없음
    vi.mocked(waitForRef).mockResolvedValueOnce('editor-ref')
    vi.mocked(evaluate)
      .mockResolvedValueOnce(undefined)  // Create 버튼 클릭
      .mockResolvedValueOnce(undefined)  // Post 버튼 클릭
      .mockResolvedValueOnce('https://www.threads.net/@testuser/post/abc123')  // extractPublishedUrl

    const promise = publishPost(makePost())
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('https://www.threads.net/@testuser/post/abc123')
    expect(navigate).toHaveBeenCalledWith('tab1', 'https://www.threads.com')
    expect(typeAction).toHaveBeenCalledWith('editor-ref', '테스트 포스트 내용입니다.')
    expect(evaluate).toHaveBeenCalledWith(expect.stringContaining('Create'))
    expect(evaluate).toHaveBeenCalledWith(expect.stringContaining('게시'))
  })

  it('로그인 필요 시 로그인 후 게시 → URL 반환', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])
    vi.mocked(snapshot)
      .mockResolvedValueOnce(LOGIN_PAGE)  // ensureLoggedIn: 로그인 페이지
      .mockResolvedValueOnce(LOGIN_PAGE)  // 비밀번호 snapshot
      .mockResolvedValueOnce(LOGIN_PAGE)  // 로그인 버튼 snapshot
      .mockResolvedValueOnce([])          // extractPublishedUrl
    vi.mocked(waitForRef)
      .mockResolvedValueOnce('email-input')  // 이메일 waitForRef
      .mockResolvedValueOnce('done')         // 로그인 완료
      .mockResolvedValueOnce('editor-ref')   // 에디터
    vi.mocked(evaluate)
      .mockResolvedValueOnce(undefined)  // Create 버튼
      .mockResolvedValueOnce(undefined)  // Post 버튼
      .mockResolvedValueOnce('https://www.threads.net/@testuser/post/abc123')

    const promise = publishPost(makePost())
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('https://www.threads.net/@testuser/post/abc123')
    expect(fill).toHaveBeenCalledWith('email-input', 'test@example.com')
    expect(fill).toHaveBeenCalledWith('pass-input', 'password123')
  })

  it('Instagram 계정 선택 버튼으로 로그인 → URL 반환', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])
    vi.mocked(snapshot)
      .mockResolvedValueOnce(INSTA_LOGIN_PAGE)  // ensureLoggedIn: Instagram 선택
      .mockResolvedValueOnce([])                // extractPublishedUrl
    vi.mocked(waitForRef)
      .mockResolvedValueOnce('done')       // 로그인 완료
      .mockResolvedValueOnce('editor-ref') // 에디터
    vi.mocked(evaluate)
      .mockResolvedValueOnce(undefined)  // Instagram 버튼 클릭
      .mockResolvedValueOnce(undefined)  // Create 버튼
      .mockResolvedValueOnce(undefined)  // Post 버튼
      .mockResolvedValueOnce('https://www.threads.net/@testuser/post/abc123')

    const promise = publishPost(makePost())
    await vi.runAllTimersAsync()
    const result = await promise

    expect(evaluate).toHaveBeenNthCalledWith(1, expect.stringContaining('Continue with Instagram'))
    expect(result).toBe('https://www.threads.net/@testuser/post/abc123')
  })

  it('URL 추출 폴백: snapshot에 없으면 evaluate → 기본 URL', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])
    vi.mocked(snapshot)
      .mockResolvedValueOnce(LOGGED_IN_HOME)
      .mockResolvedValueOnce([])  // extractPublishedUrl: 링크 없음
    vi.mocked(waitForRef).mockResolvedValueOnce('editor-ref')
    vi.mocked(evaluate)
      .mockResolvedValueOnce(undefined)  // Create
      .mockResolvedValueOnce(undefined)  // Post
      .mockResolvedValueOnce(null)       // extractPublishedUrl: querySelector null → 기본 URL

    const promise = publishPost(makePost())
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('https://www.threads.com/@testuser')
  })

  it('evaluate 에러 발생 → null 반환', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])
    vi.mocked(snapshot).mockResolvedValue(LOGGED_IN_HOME)
    vi.mocked(evaluate).mockRejectedValueOnce(new Error('[Pinchtab] evaluate error'))

    const result = await publishPost(makePost())

    expect(result).toBeNull()
  })
})

// ── publishReply ──────────────────────────────────────────────────────────────

describe('publishReply', () => {
  it('publishedUrl 없음 → false', async () => {
    const result = await publishReply(makePost(), '답글 내용')

    expect(result).toBe(false)
    expect(ensureServer).not.toHaveBeenCalled()
  })

  it('계정 없음 → false', async () => {
    vi.mocked(readStore).mockReturnValue([])

    const result = await publishReply(
      makePost({ publishedUrl: 'https://www.threads.net/@testuser/post/abc' }),
      '답글 내용'
    )

    expect(result).toBe(false)
    expect(ensureServer).not.toHaveBeenCalled()
  })

  it('전체 성공 플로우 → true, fill에 replyText 전달', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])
    vi.mocked(snapshot).mockResolvedValueOnce(LOGGED_IN_HOME)
    vi.mocked(waitForRef).mockResolvedValueOnce('reply-textbox')

    const promise = publishReply(
      makePost({ publishedUrl: 'https://www.threads.net/@testuser/post/abc' }),
      '멋진 답글입니다!'
    )
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe(true)
    expect(navigate).toHaveBeenCalledWith('tab1', 'https://www.threads.net/@testuser/post/abc')
    expect(typeAction).toHaveBeenCalledWith('reply-textbox', '멋진 답글입니다!')
    expect(evaluate).toHaveBeenCalledWith(expect.stringContaining('게시'))
  })

  it('로그인 후 답글 성공 → true', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])
    vi.mocked(snapshot)
      .mockResolvedValueOnce(LOGIN_PAGE)
      .mockResolvedValueOnce(LOGIN_PAGE)
      .mockResolvedValueOnce(LOGIN_PAGE)
    vi.mocked(waitForRef)
      .mockResolvedValueOnce('email-input')
      .mockResolvedValueOnce('done')
      .mockResolvedValueOnce('reply-textbox')

    const promise = publishReply(
      makePost({ publishedUrl: 'https://www.threads.net/@testuser/post/abc' }),
      '로그인 후 답글'
    )
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe(true)
    expect(typeAction).toHaveBeenCalledWith('reply-textbox', '로그인 후 답글')
  })

  it('에러 발생 → false', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])
    vi.mocked(snapshot).mockResolvedValue(LOGGED_IN_HOME)
    vi.mocked(waitForRef).mockRejectedValueOnce(new Error('[Pinchtab] waitForRef timeout'))

    const result = await publishReply(
      makePost({ publishedUrl: 'https://www.threads.net/@testuser/post/abc' }),
      '실패할 답글'
    )

    expect(result).toBe(false)
  })
})
