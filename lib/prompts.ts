// T-AIO — Threads AI Prompt Templates
// ★ CCG 인사이트 반영: 한국 어필리에이트 성공 패턴 기반 5각도

import type { AffiliateProduct, StrategyConfig } from './types'

export function buildHookGenerationPrompt(
  product: AffiliateProduct | null,
  topic: string,
  strategy: StrategyConfig
): string {
  const productInfo = product
    ? `제품명: ${product.name}
카테고리: ${product.category}
가격: ${product.price ? `${product.price.toLocaleString()}원` : '미정'}${product.originalPrice ? ` (원가 ${product.originalPrice.toLocaleString()}원, ${Math.round((1 - product.price! / product.originalPrice) * 100)}% 할인)` : ''}
설명: ${product.description ?? '없음'}
키워드: ${product.hookKeywords?.join(', ') ?? '없음'}`
    : `주제: ${topic}`

  return `당신은 한국 스레드(Threads) 어필리에이트 마케팅 전문 카피라이터입니다.

[Threads 알고리즘 규칙]
${strategy.systemPromptBase}

[제품/주제 정보]
${productInfo}

다음 한국 어필리에이트 특화 5가지 후킹 각도로 첫 문장을 생성하세요.
반드시 JSON 배열로만 응답하세요 (다른 텍스트 절대 포함 금지):

[
  {
    "type": "empathy_story",
    "label": "공감형 썰",
    "angle": "내가 직접 겪은 경험담으로 시작하는 문장. '나도 겪었는데...' 방식, 독자가 '맞아 나도!'를 느끼게 (1~2문장)",
    "strength": 4
  },
  {
    "type": "price_shock",
    "label": "충격 가격 비교",
    "angle": "'이 가격에?!' 반응을 유도하는 문장. 편의점/일상 물건 가격과 비교하거나 할인율로 충격 주기 (1~2문장)",
    "strength": 4
  },
  {
    "type": "comparison",
    "label": "비교 분석",
    "angle": "유명 제품/비싼 제품 대비 이 제품의 우월성을 직접 비교하는 문장. '다이슨이랑 비교해봤는데' 방식 (1~2문장)",
    "strength": 3
  },
  {
    "type": "social_proof",
    "label": "사회적 증거",
    "angle": "쿠팡 후기 수, 랭킹, 실제 사용자 반응으로 신뢰를 쌓는 문장. '후기 2만개짜리 직접 사봄' 방식 (1~2문장)",
    "strength": 3
  },
  {
    "type": "reverse",
    "label": "역발상/실패담",
    "angle": "주변의 말렸는데 사보니 오히려 좋았다는 반전 스토리. '엄마가 싸구려라고 말렸는데' 방식 (1~2문장)",
    "strength": 5
  }
]

strength는 예상 후킹 강도 (1~5). 각 angle은 반드시 한국어 구어체로 작성하세요.`
}

export function buildDraftGenerationPrompt(
  product: AffiliateProduct | null,
  topic: string,
  selectedHook: string,
  replyCount: number,
  strategy: StrategyConfig
): string {
  const productInfo = product
    ? `제품: ${product.name} | ${product.category} | ${product.price ? `${product.price.toLocaleString()}원` : ''}
설명: ${product.description ?? '없음'}
어필리에이트 링크: ${product.url}`
    : `주제: ${topic}`

  const replyGuides = [
    `"reply1": "핵심 정보 3가지 (이모지 활용, 줄바꿈으로 구분, 200자 이내)"`,
    `"reply2": "추가 팁 또는 실제 사용 예시 (200자 이내)"`,
    `"reply3": "CTA + 링크 안내\\n↓ 링크는 여기\\n[상품 바로가기] → (링크는 별도 댓글로 달 예정이라고 안내, 실제 URL 미포함, 200자 이내)"`,
  ].slice(0, replyCount)

  return `당신은 한국 스레드(Threads) 콘텐츠 전문 작가입니다.

[Threads 작성 규칙]
${strategy.systemPromptBase}

[제품/주제 정보]
${productInfo}

[선택된 후킹 각도]
${selectedHook}

아래 구조로 스레드를 작성하세요. 반드시 JSON으로만 응답하세요:

{
  "main": "본글 (${strategy.optimalPostLength}자 이내, 후킹으로 시작, URL/링크 절대 미포함, 줄바꿈 적극 활용, 구어체, 해시태그 1개만 마지막에)",
  ${replyGuides.join(',\n  ')}
}

필수 규칙:
- 본글에 외부 링크 절대 삽입 금지 (shadowban 방지)
- 해시태그는 본글 마지막 1개만
- 자연스러운 구어체 사용, 광고 티 최소화
- 이모지는 강조용으로만 1~3개`
}
