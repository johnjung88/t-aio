// test-bot.ts - publishPost + publishReply 엔드투엔드 테스트
// 실행: tsx test-bot.ts

import { publishPost, publishReply } from './lib/threads-bot'

const ACCOUNT_ID = '3a25908c-e312-4f92-8782-622367161fa1'

const testPost = {
  id: 'test-' + Date.now(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  account: ACCOUNT_ID,
  status: 'draft' as const,
  contentType: 'informational' as const,
  topic: '자동화 테스트',
  keywords: ['테스트'],
  publishedUrl: undefined,
  thread: {
    main: `[자동화 테스트] ${new Date().toLocaleTimeString('ko-KR')}`,
  },
}

async function main() {
  console.log('=== TEST 1: publishPost ===')
  console.log('포스트 내용:', testPost.thread.main)

  const publishedUrl = await publishPost(testPost)
  console.log('publishPost 결과:', publishedUrl)

  const isActualPost = publishedUrl?.includes('/post/')
  if (!isActualPost) {
    console.error('FAIL: 실제 post URL을 받지 못함 (fallback URL)')
    process.exit(1)
  }

  console.log('\n=== TEST 2: publishReply ===')
  const postWithUrl = { ...testPost, publishedUrl: publishedUrl! }
  const replyText = `답글 테스트 ${new Date().toLocaleTimeString('ko-KR')}`
  console.log('답글 내용:', replyText)

  const replyOk = await publishReply(postWithUrl, replyText)
  console.log('publishReply 결과:', replyOk)

  if (!replyOk) {
    console.error('FAIL: publishReply 실패')
    process.exit(1)
  }

  console.log('\n=== 모든 테스트 통과 ===')
  console.log('publishedUrl:', publishedUrl)
}

main().catch(err => { console.error(err); process.exit(1) })
