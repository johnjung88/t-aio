import { describe, it, expect } from 'vitest'
import {
  postCreateBodySchema,
  postPatchBodySchema,
  productCreateBodySchema,
  accountCreateBodySchema,
  generateHookBodySchema,
  generateDraftBodySchema,
  schedulerBodySchema,
  scrapeBodySchema,
} from '@/lib/schemas'

describe('postCreateBodySchema', () => {
  it('빈 객체를 허용한다 (모든 필드 optional)', () => {
    expect(postCreateBodySchema.safeParse({}).success).toBe(true)
  })

  it('유효한 입력을 통과시킨다', () => {
    const result = postCreateBodySchema.safeParse({
      contentType: 'affiliate',
      topic: '다이어트 제품 리뷰',
      keywords: ['다이어트', '쿠팡'],
    })
    expect(result.success).toBe(true)
  })

  it('잘못된 contentType 거부', () => {
    const result = postCreateBodySchema.safeParse({ contentType: 'invalid' })
    expect(result.success).toBe(false)
  })
})

describe('postPatchBodySchema', () => {
  it('status 업데이트 허용', () => {
    const result = postPatchBodySchema.safeParse({ status: 'draft' })
    expect(result.success).toBe(true)
  })

  it('잘못된 status 거부', () => {
    const result = postPatchBodySchema.safeParse({ status: 'invalid_status' })
    expect(result.success).toBe(false)
  })
})

describe('productCreateBodySchema', () => {
  it('필수 필드(name, url) 포함 시 통과', () => {
    const result = productCreateBodySchema.safeParse({
      name: '공기청정기',
      url: 'https://coupang.com/product/123',
    })
    expect(result.success).toBe(true)
  })

  it('name 누락 시 실패', () => {
    const result = productCreateBodySchema.safeParse({
      url: 'https://coupang.com/product/123',
    })
    expect(result.success).toBe(false)
  })

  it('url 누락 시 실패', () => {
    const result = productCreateBodySchema.safeParse({ name: '제품명' })
    expect(result.success).toBe(false)
  })

  it('잘못된 url 형식 거부', () => {
    const result = productCreateBodySchema.safeParse({
      name: '제품',
      url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })
})

describe('accountCreateBodySchema', () => {
  it('username만으로 통과', () => {
    const result = accountCreateBodySchema.safeParse({ username: 'john' })
    expect(result.success).toBe(true)
  })

  it('username 누락 시 실패', () => {
    const result = accountCreateBodySchema.safeParse({ displayName: 'John' })
    expect(result.success).toBe(false)
  })

  it('빈 username 거부', () => {
    const result = accountCreateBodySchema.safeParse({ username: '' })
    expect(result.success).toBe(false)
  })
})

describe('generateHookBodySchema', () => {
  it('postId 포함 시 통과', () => {
    const result = generateHookBodySchema.safeParse({ postId: 'abc-123' })
    expect(result.success).toBe(true)
  })

  it('postId 누락 시 실패', () => {
    const result = generateHookBodySchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('generateDraftBodySchema', () => {
  it('postId + 유효한 replyCount 통과', () => {
    const result = generateDraftBodySchema.safeParse({ postId: 'x', replyCount: 2 })
    expect(result.success).toBe(true)
  })

  it('replyCount가 3 초과 시 실패', () => {
    const result = generateDraftBodySchema.safeParse({ postId: 'x', replyCount: 4 })
    expect(result.success).toBe(false)
  })
})

describe('schedulerBodySchema', () => {
  it('start action 통과', () => {
    const result = schedulerBodySchema.safeParse({ action: 'start', accountId: 'acc1' })
    expect(result.success).toBe(true)
  })

  it('잘못된 action 거부', () => {
    const result = schedulerBodySchema.safeParse({ action: 'run', accountId: 'acc1' })
    expect(result.success).toBe(false)
  })
})

describe('scrapeBodySchema', () => {
  it('유효한 url 통과', () => {
    const result = scrapeBodySchema.safeParse({ url: 'https://example.com' })
    expect(result.success).toBe(true)
  })

  it('잘못된 url 거부', () => {
    const result = scrapeBodySchema.safeParse({ url: 'not-a-url' })
    expect(result.success).toBe(false)
  })
})
