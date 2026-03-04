// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SnapElement } from '@/lib/pinchtab'
import type { Account, ThreadPost } from '@/lib/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/store', () => ({
  readStore: vi.fn(),
}))

vi.mock('@/lib/pinchtab', () => ({
  ensureServer: vi.fn(),
  ensureProfile: vi.fn(),
  startInstance: vi.fn(),
  openTab: vi.fn(),
  navigate: vi.fn(),
  snapshot: vi.fn(),
  click: vi.fn(),
  fill: vi.fn(),
  type: vi.fn(),
  evaluate: vi.fn(),
  waitForRef: vi.fn(),
  getText: vi.fn(),
}))

import { readStore } from '@/lib/store'
import {
  ensureServer,
  ensureProfile,
  startInstance,
  openTab,
  snapshot,
  click,
  fill,
  type as typeAction,
  evaluate,
  waitForRef,
  getText,
} from '@/lib/pinchtab'

import { publishPost, publishReply } from '@/lib/threads-bot'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LOGGED_IN_HOME: SnapElement[] = [
  { ref: 'home-link', role: 'link', name: '홈' },
  { ref: 'search-link', role: 'link', name: '검색' },
  { ref: 'new-post-link', role: 'link', href: '/intent/post' },
  { ref: 'profile-link', role: 'link', name: '프로필' },
]

const LOGIN_PAGE: SnapElement[] = [
  { ref: 'email-input', type: 'email', placeholder: 'Email address' },
  { ref: 'pass-input', type: 'password', placeholder: 'Password' },
  { ref: 'submit-btn', type: 'submit', name: 'Log in' },
]

const POST_EDITOR: SnapElement[] = [
  { ref: 'editor-ref', role: 'textbox', placeholder: '스레드 시작하기...' },
  { ref: 'post-btn', role: 'button', name: '게시', text: '게시' },
]

const AFTER_PUBLISH: SnapElement[] = [
  { ref: 'post-link', role: 'link', href: 'https://www.threads.net/@testuser/post/abc123' },
  { ref: 'reply-box', role: 'textbox', placeholder: '답글 달기...' },
]

const REPLY_VIEW: SnapElement[] = [
  { ref: 'reply-textbox', role: 'textbox', placeholder: '답글 달기...' },
  { ref: 'reply-post-btn', role: 'button', name: '게시', text: '게시' },
]

const INSTA_LOGIN_PAGE: SnapElement[] = [
  { ref: 'insta-btn', role: 'button', name: 'Instagram Continue with Instagram testuser Log in' },
]

// ── Test account / post helpers ───────────────────────────────────────────────

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

beforeEach(() => {
  vi.resetAllMocks()  // clearAllMocks는 mockOnce 큐를 초기화하지 않아서 테스트 간 오염 발생
  vi.mocked(ensureServer).mockResolvedValue(undefined)
  vi.mocked(ensureProfile).mockResolvedValue('profile1')
  vi.mocked(startInstance).mockResolvedValue('inst1')
  vi.mocked(openTab).mockResolvedValue('tab1')
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

    // snapshot 호출 순서:
    // 1) ensureLoggedIn — 홈 화면(로그인 상태)
    // 2) waitForRef(newPostRef) 내부
    // 3) waitForRef(editorRef) 내부
    // 4) 게시 버튼 찾기
    // 5) extractPublishedUrl의 snapshot
    vi.mocked(snapshot).mockResolvedValue(LOGGED_IN_HOME)

    // waitForRef: 에디터 대기 1회 (Create 버튼은 evaluate()로 직접 클릭)
    vi.mocked(waitForRef).mockResolvedValueOnce('editor-ref')

    // 게시 버튼을 위한 snapshot — POST_EDITOR 반환
    vi.mocked(snapshot)
      .mockResolvedValueOnce(LOGGED_IN_HOME)  // ensureLoggedIn
      .mockResolvedValueOnce(POST_EDITOR)     // 게시 버튼 탐색
      .mockResolvedValueOnce(AFTER_PUBLISH)   // extractPublishedUrl

    const result = await publishPost(makePost())

    expect(result).toBe('https://www.threads.net/@testuser/post/abc123')
    expect(typeAction).toHaveBeenCalledWith('tab1', 'editor-ref', '테스트 포스트 내용입니다.')
    expect(click).toHaveBeenCalledWith('tab1', 'post-btn')
  })

  it('로그인 필요 시 로그인 후 게시 → URL 반환', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])

    vi.mocked(snapshot)
      .mockResolvedValueOnce(LOGIN_PAGE)      // ensureLoggedIn → 로그인 페이지
      .mockResolvedValueOnce(LOGIN_PAGE)      // 비밀번호 입력용 snapshot
      .mockResolvedValueOnce(LOGIN_PAGE)      // 로그인 버튼 snapshot
      .mockResolvedValueOnce(POST_EDITOR)     // 게시 버튼 snapshot
      .mockResolvedValueOnce(AFTER_PUBLISH)   // extractPublishedUrl

    vi.mocked(waitForRef)
      .mockResolvedValueOnce('email-input')   // email waitForRef
      .mockResolvedValueOnce('done')          // 로그인 완료 대기
      .mockResolvedValueOnce('editor-ref')    // 에디터 (Create 버튼은 evaluate()로 클릭)

    const result = await publishPost(makePost())

    expect(result).toBe('https://www.threads.net/@testuser/post/abc123')
    expect(fill).toHaveBeenCalledWith('tab1', 'email-input', 'test@example.com')
    expect(fill).toHaveBeenCalledWith('tab1', 'pass-input', 'password123')
  })

  it('Instagram 계정 선택 버튼으로 로그인 → URL 반환', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])

    vi.mocked(snapshot)
      .mockResolvedValueOnce(INSTA_LOGIN_PAGE)  // ensureLoggedIn: Instagram 선택 화면
      .mockResolvedValueOnce(POST_EDITOR)        // 게시 버튼 탐색
      .mockResolvedValueOnce(AFTER_PUBLISH)      // extractPublishedUrl

    vi.mocked(waitForRef)
      .mockResolvedValueOnce('done')             // 로그인 완료 대기
      .mockResolvedValueOnce('editor-ref')       // 에디터

    const result = await publishPost(makePost())

    expect(evaluate).toHaveBeenCalledWith('tab1', expect.stringContaining('Continue with Instagram'))
    expect(typeAction).toHaveBeenCalledWith('tab1', 'editor-ref', '테스트 포스트 내용입니다.')
    expect(result).toBe('https://www.threads.net/@testuser/post/abc123')
  })

  it('에디터 waitForRef 타임아웃 → null 반환', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])
    vi.mocked(snapshot).mockResolvedValue(LOGGED_IN_HOME)

    vi.mocked(waitForRef)
      .mockResolvedValueOnce('new-post-link')
      .mockRejectedValueOnce(new Error('[Pinchtab] waitForRef timeout (10000ms)'))

    const result = await publishPost(makePost())

    expect(result).toBeNull()
  })

  it('게시 버튼 못 찾음 → null 반환', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])

    vi.mocked(snapshot)
      .mockResolvedValueOnce(LOGGED_IN_HOME)
      .mockResolvedValueOnce([])  // 게시 버튼 없음

    vi.mocked(waitForRef)
      .mockResolvedValueOnce('new-post-link')
      .mockResolvedValueOnce('editor-ref')

    const result = await publishPost(makePost())

    expect(result).toBeNull()
  })

  it('URL 추출 폴백: snapshot에 없으면 getText → 기본 URL', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])

    vi.mocked(snapshot)
      .mockResolvedValueOnce(LOGGED_IN_HOME)
      .mockResolvedValueOnce(POST_EDITOR)
      .mockResolvedValueOnce([])  // extractPublishedUrl: 링크 없음

    vi.mocked(waitForRef).mockResolvedValueOnce('editor-ref')

    vi.mocked(getText).mockResolvedValueOnce(
      '방문하세요 https://www.threads.net/@testuser/post/xyz789'
    )

    const result = await publishPost(makePost())

    expect(result).toBe('https://www.threads.net/@testuser/post/xyz789')
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

    vi.mocked(snapshot).mockResolvedValue(LOGGED_IN_HOME)  // ensureLoggedIn: 이미 로그인
    vi.mocked(waitForRef).mockResolvedValueOnce('reply-textbox')

    vi.mocked(snapshot)
      .mockResolvedValueOnce(LOGGED_IN_HOME)
      .mockResolvedValueOnce(REPLY_VIEW)  // 게시 버튼 snapshot

    const result = await publishReply(
      makePost({ publishedUrl: 'https://www.threads.net/@testuser/post/abc' }),
      '멋진 답글입니다!'
    )

    expect(result).toBe(true)
    expect(typeAction).toHaveBeenCalledWith('tab1', 'reply-textbox', '멋진 답글입니다!')
    expect(click).toHaveBeenCalledWith('tab1', 'reply-post-btn')
  })

  it('로그인 후 답글 성공 → true', async () => {
    vi.mocked(readStore).mockReturnValue([makeAccount()])

    vi.mocked(snapshot)
      .mockResolvedValueOnce(LOGIN_PAGE)    // ensureLoggedIn: 로그인 페이지
      .mockResolvedValueOnce(LOGIN_PAGE)    // 비밀번호 snapshot
      .mockResolvedValueOnce(LOGIN_PAGE)    // 로그인 버튼 snapshot
      .mockResolvedValueOnce(REPLY_VIEW)    // 게시 버튼

    vi.mocked(waitForRef)
      .mockResolvedValueOnce('email-input') // 로그인: 이메일
      .mockResolvedValueOnce('done')        // 로그인 완료
      .mockResolvedValueOnce('reply-textbox')  // 답글 입력창

    const result = await publishReply(
      makePost({ publishedUrl: 'https://www.threads.net/@testuser/post/abc' }),
      '로그인 후 답글'
    )

    expect(result).toBe(true)
    expect(typeAction).toHaveBeenCalledWith('tab1', 'reply-textbox', '로그인 후 답글')
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
