// T-AIO — Threads AI Prompt Templates

import type { AffiliateProduct, StrategyConfig } from './types'

export function buildHookGenerationPrompt(
  product: AffiliateProduct | null,
  topic: string,
  strategy: StrategyConfig
): string {
  const productInfo = product
    ? `
제품명: ${product.name}
카테고리: ${product.category}
가격: ${product.price ? `${product.price.toLocaleString()}원` : '미정'}
설명: ${product.description || '없음'}
키워드: ${product.hookKeywords?.join(', ') || '없음'}
어필리에이트 URL: ${product.url}
`
    : `주제: ${topic}`

  return `당신은 한국 스레드(Threads) 어필리에이트 마케팅 전문가입니다.

[Threads 알고리즘 규칙]
${strategy.systemPromptBase}

[후킹 공식]
${strategy.hookFormulas.map((f, i) => `${i + 1}. ${f}`).join('\n')}

[제품/주제 정보]
${productInfo}

위 정보를 바탕으로 다음 5가지 후킹 각도를 생성하세요.
반드시 JSON 배열로만 응답하고 다른 텍스트는 포함하지 마세요:

[
  {
    "type": "pain",
    "label": "고통포인트 후킹",
    "angle": "문제→해결 형태의 후킹 각도 (1-2문장)",
    "strength": 4
  },
  {
    "type": "curiosity",
    "label": "궁금증 유발",
    "angle": "반전/비밀 형태의 후킹 각도 (1-2문장)",
    "strength": 5
  },
  {
    "type": "number",
    "label": "숫자 후킹",
    "angle": "n가지 이유/방법 형태의 후킹 각도 (1-2문장)",
    "strength": 3
  },
  {
    "type": "empathy",
    "label": "공감 후킹",
    "angle": "나만 그런가? 형태의 후킹 각도 (1-2문장)",
    "strength": 4
  },
  {
    "type": "comparison",
    "label": "비교 후킹",
    "angle": "before/after 형태의 후킹 각도 (1-2문장)",
    "strength": 3
  }
]

strength는 예상 후킹 강도로 1(약함)~5(매우 강함) 사이 정수입니다.`
}

export function buildDraftGenerationPrompt(
  product: AffiliateProduct | null,
  topic: string,
  selectedHook: string,
  replyCount: number,
  strategy: StrategyConfig
): string {
  const productInfo = product
    ? `제품: ${product.name} | 카테고리: ${product.category} | 가격: ${product.price ? `${product.price.toLocaleString()}원` : '미정'}
설명: ${product.description || '없음'}
어필리에이트 링크: ${product.url}`
    : `주제: ${topic}`

  const replyInstructions = [
    '댓글1: 핵심 정보/이유 3가지 (간결하게, 이모지 활용)',
    '댓글2: 추가 팁 또는 실제 사용 예시',
    '댓글3: 자연스러운 CTA + 어필리에이트 링크 삽입',
  ]
    .slice(0, replyCount)
    .join('\n')

  return `당신은 한국 스레드(Threads) 콘텐츠 전문 작가입니다.

[Threads 작성 규칙]
${strategy.systemPromptBase}

[제품/주제 정보]
${productInfo}

[선택된 후킹 각도]
${selectedHook}

다음 구조로 스레드를 작성하세요. 반드시 JSON으로만 응답하세요:

{
  "main": "본글 (${strategy.optimalPostLength}자 이내, 후킹 문장으로 시작, 링크 미포함, 줄바꿈 활용)",
  ${replyCount >= 1 ? '"reply1": "댓글1: 핵심 정보 (이모지 활용, 200자 이내)",' : ''}
  ${replyCount >= 2 ? '"reply2": "댓글2: 추가 팁/예시 (200자 이내)",' : ''}
  ${replyCount >= 3 ? '"reply3": "댓글3: CTA + ' + (product ? `${product.url} 링크 포함` : 'CTA') + ' (200자 이내)"' : ''}
}

규칙:
- 본글은 후킹으로 시작해 궁금증을 유발, 댓글을 읽도록 유도
- 자연스러운 구어체, 과장 광고 느낌 없이
- 해시태그: ${strategy.hashtagStrategy}
- 이모지를 적절히 활용 (과하지 않게)
${replyInstructions ? `\n[댓글 작성 가이드]\n${replyInstructions}` : ''}`
}
