import { describe, it, expect } from 'vitest'
import { buildHookGenerationPrompt, buildDraftGenerationPrompt } from '@/lib/prompts'
import type { AffiliateProduct, StrategyConfig } from '@/lib/types'

const mockStrategy: StrategyConfig = {
  systemPromptBase: '스레드 알고리즘 최적화 지침',
  hookFormulas: ['공감형', '충격형'],
  optimalPostLength: 150,
  hashtagStrategy: '1개만',
  bestPostTimes: ['09:00', '21:00'],
  replyCount: 2,
  commentDelayMin: 20,
  commentDelayMax: 90,
}

const mockProduct: AffiliateProduct = {
  id: 'p1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  name: '공기청정기',
  url: 'https://coupang.com/p/123',
  platform: 'coupang',
  category: '가전',
  price: 49900,
  originalPrice: 89900,
  description: '미세먼지 99% 제거',
  hookKeywords: ['공기질', '미세먼지'],
  useCount: 0,
}

describe('buildHookGenerationPrompt', () => {
  it('제품 정보가 있을 때 제품명이 포함된다', () => {
    const result = buildHookGenerationPrompt(mockProduct, '', mockStrategy)
    expect(result).toContain('공기청정기')
  })

  it('제품 없을 때 topic을 사용한다', () => {
    const result = buildHookGenerationPrompt(null, '다이어트 팁', mockStrategy)
    expect(result).toContain('다이어트 팁')
  })

  it('strategy.systemPromptBase가 포함된다', () => {
    const result = buildHookGenerationPrompt(null, '테스트', mockStrategy)
    expect(result).toContain('스레드 알고리즘 최적화 지침')
  })

  it('5가지 후킹 타입이 포함된다', () => {
    const result = buildHookGenerationPrompt(null, '테스트', mockStrategy)
    expect(result).toContain('empathy_story')
    expect(result).toContain('price_shock')
    expect(result).toContain('comparison')
    expect(result).toContain('social_proof')
    expect(result).toContain('reverse')
  })

  it('문자열을 반환한다', () => {
    const result = buildHookGenerationPrompt(mockProduct, '', mockStrategy)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(100)
  })

  it('할인율 계산이 포함된다 (price + originalPrice 모두 있을 때)', () => {
    const result = buildHookGenerationPrompt(mockProduct, '', mockStrategy)
    // 49900 / 89900 ≈ 44.5% → 약 44% 할인
    expect(result).toMatch(/\d+%/)
  })
})

describe('buildDraftGenerationPrompt', () => {
  it('선택된 후킹 각도가 포함된다', () => {
    const result = buildDraftGenerationPrompt(mockProduct, '', '엄마가 싸구려라고 말렸는데', 1, mockStrategy)
    expect(result).toContain('엄마가 싸구려라고 말렸는데')
  })

  it('replyCount=0이면 reply 가이드 없음', () => {
    const result = buildDraftGenerationPrompt(null, '테스트', '후킹', 0, mockStrategy)
    expect(result).not.toContain('reply1')
  })

  it('replyCount=2이면 reply1, reply2 가이드 포함', () => {
    const result = buildDraftGenerationPrompt(null, '테스트', '후킹', 2, mockStrategy)
    expect(result).toContain('reply1')
    expect(result).toContain('reply2')
    expect(result).not.toContain('reply3')
  })

  it('optimalPostLength가 본글 안내에 포함된다', () => {
    const result = buildDraftGenerationPrompt(null, '테스트', '후킹', 0, mockStrategy)
    expect(result).toContain('150')
  })

  it('제품 URL이 포함된다 (링크 안내용)', () => {
    const result = buildDraftGenerationPrompt(mockProduct, '', '후킹', 0, mockStrategy)
    expect(result).toContain('https://coupang.com/p/123')
  })
})
