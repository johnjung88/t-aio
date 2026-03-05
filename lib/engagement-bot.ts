// T-AIO — v2 인게이지먼트 엔진
// 타인 포스트 댓글/좋아요/팔로우 자동화 (Pinchtab 기반)

import type { Account } from './types'
import {
  ensureServer,
  ensureProfile,
  startInstance,
  stopInstance,
  openTab,
  click,
  type as typeText,
  evaluate,
  waitForRef,
} from './pinchtab'
import { ensureLoggedIn, findRef } from './threads-bot'

// ─── 타인 포스트에 댓글 달기 ────────────────────────────────────────────────

export async function commentOnPost(
  account: Account,
  targetUrl: string,
  commentText: string
): Promise<{ success: boolean; error?: string }> {
  if (!account.loginEmail) return { success: false, error: '로그인 정보 없음' }

  await ensureServer()
  const profileId = await ensureProfile(account.username)
  const instanceId = await startInstance(profileId)

  try {
    const tabId = await openTab(instanceId, targetUrl)
    await ensureLoggedIn(tabId, account)

    // 답글 입력창 찾기
    const replyRef = await waitForRef(
      tabId,
      els => findRef(els,
        e => e.role === 'textbox' && typeof e.placeholder === 'string' && /답글|reply/i.test(e.placeholder),
        e => e.role === 'textbox'
      ),
      15000
    )
    await typeText(tabId, replyRef, commentText)

    // 게시 버튼 클릭
    await evaluate(tabId,
      `Array.from(document.querySelectorAll('[role=button]'))
        .find(e => e.textContent.trim() === '게시' || e.textContent.trim() === 'Post')?.click()`
    )

    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log(`[Engagement] 댓글 완료: ${targetUrl.slice(0, 50)}...`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Engagement] 댓글 실패:', msg)
    return { success: false, error: msg }
  } finally {
    await stopInstance(instanceId).catch(() => {})
  }
}

// ─── 타인 포스트 좋아요 ─────────────────────────────────────────────────────

export async function likePost(
  account: Account,
  targetUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!account.loginEmail) return { success: false, error: '로그인 정보 없음' }

  await ensureServer()
  const profileId = await ensureProfile(account.username)
  const instanceId = await startInstance(profileId)

  try {
    const tabId = await openTab(instanceId, targetUrl)
    await ensureLoggedIn(tabId, account)

    // 좋아요 버튼 찾기 (하트 아이콘 / Like 버튼)
    await evaluate(tabId,
      `(() => {
        const btns = Array.from(document.querySelectorAll('[role=button]'));
        const like = btns.find(e => e.querySelector('svg[aria-label*="Like"]') || e.querySelector('svg[aria-label*="좋아요"]'));
        if (like) like.click();
      })()`
    )

    await new Promise(resolve => setTimeout(resolve, 1500))
    console.log(`[Engagement] 좋아요 완료: ${targetUrl.slice(0, 50)}...`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Engagement] 좋아요 실패:', msg)
    return { success: false, error: msg }
  } finally {
    await stopInstance(instanceId).catch(() => {})
  }
}

// ─── 유저 팔로우 ────────────────────────────────────────────────────────────

export async function followUser(
  account: Account,
  targetUsername: string
): Promise<{ success: boolean; error?: string }> {
  if (!account.loginEmail) return { success: false, error: '로그인 정보 없음' }

  await ensureServer()
  const profileId = await ensureProfile(account.username)
  const instanceId = await startInstance(profileId)

  try {
    const tabId = await openTab(instanceId, `https://www.threads.net/@${targetUsername}`)
    await ensureLoggedIn(tabId, account)

    // 팔로우 버튼 찾기
    const followRef = await waitForRef(
      tabId,
      els => findRef(els,
        e => e.role === 'button' && typeof e.name === 'string' && /follow|팔로우/i.test(e.name) && !/following|팔로잉/i.test(e.name)
      ),
      10000
    )
    await click(tabId, followRef)

    await new Promise(resolve => setTimeout(resolve, 1500))
    console.log(`[Engagement] 팔로우 완료: @${targetUsername}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Engagement] 팔로우 실패:', msg)
    return { success: false, error: msg }
  } finally {
    await stopInstance(instanceId).catch(() => {})
  }
}

// ─── 키워드로 포스트 검색 ───────────────────────────────────────────────────

export async function findPostsByKeyword(
  account: Account,
  keyword: string,
  limit = 10
): Promise<{ url: string; username: string; text: string }[]> {
  if (!account.loginEmail) return []

  await ensureServer()
  const profileId = await ensureProfile(account.username)
  const instanceId = await startInstance(profileId)

  try {
    const tabId = await openTab(instanceId, `https://www.threads.net/search?q=${encodeURIComponent(keyword)}&serp_type=default`)
    await ensureLoggedIn(tabId, account)

    // 검색 결과 로딩 대기
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 포스트 링크 + 텍스트 추출
    const results = await evaluate(tabId, `
      (() => {
        const posts = [];
        const links = document.querySelectorAll('a[href*="/post/"]');
        const seen = new Set();
        for (const link of links) {
          const href = link.href;
          if (seen.has(href)) continue;
          seen.add(href);
          const container = link.closest('[data-pressable-container]') || link.parentElement?.parentElement;
          const text = container?.textContent?.trim()?.slice(0, 200) || '';
          const match = href.match(/@([^/]+)/);
          posts.push({ url: href, username: match?.[1] || '', text });
          if (posts.length >= ${limit}) break;
        }
        return posts;
      })()
    `) as { url: string; username: string; text: string }[]

    console.log(`[Engagement] 검색 '${keyword}': ${results?.length ?? 0}개 발견`)
    return results ?? []
  } catch (err) {
    console.error('[Engagement] 검색 실패:', err)
    return []
  } finally {
    await stopInstance(instanceId).catch(() => {})
  }
}
