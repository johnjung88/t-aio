// test-bot.mjs - publishPost + publishReply 엔드투엔드 테스트
// 실행: node --import tsx/esm test-bot.mjs (또는 npx tsx test-bot.mjs)

import { publishPost, publishReply } from './lib/threads-bot.ts'

const ACCOUNT_ID = '3a25908c-e312-4f92-8782-622367161fa1'

const testPost = {
  id: 'test-' + Date.now(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  account: ACCOUNT_ID,
  status: 'draft',
  publishedUrl: null,
  thread: {
    main: `[테스트] 자동화 포스트 ${new Date().toLocaleTimeString('ko-KR')}`,
    reply: null,
  },
}

console.log('=== TEST 1: publishPost ===')
console.log('포스트 내용:', testPost.thread.main)

const publishedUrl = await publishPost(testPost)
console.log('publishPost 결과:', publishedUrl)

if (!publishedUrl || publishedUrl.includes('/@')) {
  // 프로파일 fallback URL은 실패로 간주
  const isActualPost = publishedUrl?.includes('/post/')
  if (!isActualPost) {
    console.error('FAIL: 실제 post URL을 받지 못함')
    process.exit(1)
  }
}

console.log('\n=== TEST 2: publishReply ===')
const postWithUrl = { ...testPost, publishedUrl }
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
