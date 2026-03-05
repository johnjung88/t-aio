import type { Account, ThreadPost } from './types'
import { readStore } from './store'
import {
  ensureServer,
  ensureProfile,
  startInstance,
  stopInstance,
  openTab,
  navigate,
  snapshot,
  click,
  fill,
  type as typeText,
  evaluate,
  waitForRef,
  type SnapElement,
} from './pinchtab'

// ─── Login Check/Flow ─────────────────────────────────────────────────────────

function findRef(elements: SnapElement[], ...matchers: Array<(e: SnapElement) => boolean>): string | null {
  for (const matcher of matchers) {
    const found = elements.find(matcher)
    if (found) return found.ref
  }
  return null
}

async function ensureLoggedIn(tabId: string, account: Account): Promise<void> {
  const elements = await snapshot(tabId)

  const isLoginPage = elements.some(e =>
    e.type === 'email' ||
    (typeof e.placeholder === 'string' && /email|이메일|username/i.test(e.placeholder)) ||
    (typeof e.name === 'string' && /log.?in|sign.?in|로그인/i.test(e.name))
  )

  if (!isLoginPage) return

  console.log(`[Bot] 로그인 진행: ${account.username}`)

  const instaBtn = elements.find(e =>
    e.role === 'button' &&
    typeof e.name === 'string' &&
    (/continue with instagram/i.test(e.name) || e.name.includes(account.username))
  )

  if (instaBtn) {
    console.log(`[Bot] 인스타그램 계정 선택 클릭: ${account.username}`)
    await evaluate(tabId,
      `Array.from(document.querySelectorAll('[role=button]'))
        .find(e => e.textContent.includes('Continue with Instagram') || e.textContent.includes(${JSON.stringify(account.username)}))?.click()`
    )
  } else {
    const emailRef = await waitForRef(
      tabId,
      els => findRef(els,
        e => e.type === 'email',
        e => typeof e.placeholder === 'string' && /email|이메일|username/i.test(e.placeholder)
      ),
      10000
    )
    await fill(tabId, emailRef, account.loginEmail!)

    const elements2 = await snapshot(tabId)
    const passRef = findRef(elements2, e => e.type === 'password')
    if (!passRef) throw new Error('[Bot] 비밀번호 입력창을 찾을 수 없음')
    await fill(tabId, passRef, account.loginPassword!)

    const elements3 = await snapshot(tabId)
    const loginRef = findRef(
      elements3,
      e => e.type === 'submit',
      e => typeof e.name === 'string' && /log.?in|sign.?in|로그인/i.test(e.name)
    )
    if (!loginRef) throw new Error('[Bot] 로그인 버튼을 찾을 수 없음')
    await click(tabId, loginRef)
  }

  await waitForRef(
    tabId,
    els => {
      const stillOnLogin = els.some(e =>
        e.type === 'password' ||
        (e.role === 'button' && typeof e.name === 'string' && /continue with instagram/i.test(e.name))
      )
      return stillOnLogin ? null : 'done'
    },
    20000
  )
  console.log(`[Bot] 로그인 완료: ${account.username}`)
}

// ─── Publish Post ─────────────────────────────────────────────────────────────

export async function publishPost(post: ThreadPost): Promise<string | null> {
  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find(a => a.id === post.account)
  if (!account?.loginEmail) {
    console.error(`[Bot] 계정 로그인 정보 없음: ${post.account}`)
    return null
  }

  await ensureServer()
  const profileId = await ensureProfile(account.username)
  const instanceId = await startInstance(profileId)

  try {
    const tabId = await openTab(instanceId, 'https://www.threads.net')
    await ensureLoggedIn(tabId, account)

    await evaluate(tabId,
      `Array.from(document.querySelectorAll('div[role=button]'))
        .find(e => e.textContent.trim() === 'Create')?.click()`
    )

    const editorRef = await waitForRef(
      tabId,
      els => findRef(els, e => e.role === 'textbox'),
      10000
    )
    await typeText(tabId, editorRef, post.thread.main)

    await evaluate(tabId,
      `Array.from(document.querySelectorAll('[role=button]'))
        .find(e => e.textContent.trim() === '게시' || e.textContent.trim() === 'Post')?.click()`
    )

    await new Promise(resolve => setTimeout(resolve, 3000))

    const publishedUrl = await extractPublishedUrl(tabId, account.username)
    console.log(`[Bot] 발행 완료: ${post.id} → ${publishedUrl}`)
    return publishedUrl
  } catch (err) {
    console.error('[Bot] 발행 실패:', err)
    return null
  } finally {
    await stopInstance(instanceId).catch(() => {})
  }
}

async function extractPublishedUrl(tabId: string, username: string): Promise<string> {
  const elements = await snapshot(tabId)
  const postLink = elements.find(e =>
    typeof e.href === 'string' &&
    e.href.includes('/post/') &&
    e.href.includes(username)
  )
  if (postLink?.href) return postLink.href as string

  const href = await evaluate(tabId, `document.querySelector('a[href*="/post/"]')?.href`)
  if (typeof href === 'string' && href.includes('/post/')) return href

  return `https://www.threads.net/@${username}`
}

// ─── Publish Reply ────────────────────────────────────────────────────────────

export async function publishReply(post: ThreadPost, replyText: string): Promise<boolean> {
  if (!post.publishedUrl) {
    console.error(`[Bot] 발행된 URL 없음: ${post.id}`)
    return false
  }

  const accounts = readStore<Account[]>('accounts', [])
  const account = accounts.find(a => a.id === post.account)
  if (!account?.loginEmail) {
    console.error(`[Bot] 계정 로그인 정보 없음: ${post.account}`)
    return false
  }

  await ensureServer()
  const profileId = await ensureProfile(account.username)
  const instanceId = await startInstance(profileId)

  try {
    const tabId = await openTab(instanceId, post.publishedUrl)
    await ensureLoggedIn(tabId, account)

    const replyRef = await waitForRef(
      tabId,
      els => findRef(els,
        e => e.role === 'textbox' && typeof e.placeholder === 'string' && /답글|reply/i.test(e.placeholder),
        e => e.role === 'textbox'
      ),
      15000
    )
    await typeText(tabId, replyRef, replyText)

    await evaluate(tabId,
      `Array.from(document.querySelectorAll('[role=button]'))
        .find(e => e.textContent.trim() === '게시' || e.textContent.trim() === 'Post')?.click()`
    )

    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log(`[Bot] 답글 완료: post ${post.id}, 내용: ${replyText.slice(0, 30)}...`)
    return true
  } catch (err) {
    console.error('[Bot] 답글 실패:', err)
    return false
  } finally {
    await stopInstance(instanceId).catch(() => {})
  }
}
