// T-AIO — Threads AI Prompt Templates
// v2: 6레이어 프롬프트 구조 + 콘텐츠 포맷별 지시 + 인게이지먼트 댓글

import type { AffiliateProduct, ContentFormat, StrategyConfig } from './types'

// ─── 6레이어 프롬프트 빌더 ──────────────────────────────────────────────────

function buildPromptLayers(strategy: StrategyConfig): string {
  const layers: string[] = []

  // Layer 1: 페르소나
  const persona = strategy.persona || strategy.systemPromptBase
  if (persona) {
    layers.push(`[Layer 1: 페르소나]\n${persona}`)
  }

  // Layer 2: 타겟 오디언스
  if (strategy.targetAudience) {
    layers.push(`[Layer 2: 타겟 오디언스]\n${strategy.targetAudience}`)
  }

  // Layer 3: 브랜드 보이스
  if (strategy.brandVoice) {
    layers.push(`[Layer 3: 톤 & 보이스]\n${strategy.brandVoice}`)
  }

  // Layer 4: 콘텐츠 규칙
  if (strategy.contentRules?.length) {
    layers.push(`[Layer 4: 콘텐츠 규칙]\n${strategy.contentRules.map(r => `- ${r}`).join('\n')}`)
  }

  // Layer 5: 플랫폼 규칙
  if (strategy.platformRules?.length) {
    layers.push(`[Layer 5: Threads 플랫폼 규칙]\n${strategy.platformRules.map(r => `- ${r}`).join('\n')}`)
  }

  // Layer 6: 예시 포스트
  if (strategy.examplePosts?.length) {
    layers.push(`[Layer 6: 참고 예시]\n${strategy.examplePosts.map((p, i) => `예시${i + 1}: ${p}`).join('\n')}`)
  }

  // Fallback: 기존 systemPromptBase (Layer 1과 별개로 알고리즘 규칙이 있는 경우)
  if (strategy.persona && strategy.systemPromptBase) {
    layers.push(`[Threads 알고리즘 규칙]\n${strategy.systemPromptBase}`)
  }

  return layers.join('\n\n')
}

// ─── 콘텐츠 포맷별 지시 ─────────────────────────────────────────────────────

const FORMAT_INSTRUCTIONS: Record<ContentFormat, string> = {
  hook_opinion: '도발적 의견으로 시작. 강한 주장 → 근거 → 독자에게 의견 묻기. 댓글을 유도하는 구조.',
  question: '질문으로 끝나는 포스트. 독자의 경험/의견을 물어 댓글을 유발하는 구조.',
  poll: '투표(폴) 형태. "A vs B 어떤게 더 좋아?" 방식. 4개 이하 선택지 제시.',
  tip_value: '실용적 팁 제공. 번호 매긴 리스트 형태. 저장/리포스트를 유도하는 실질적 가치.',
  story: '개인 경험담/실패담으로 시작. 공감 → 교훈 → 독자 행동 유도. 스토리텔링 구조.',
  image_text: '짧은 캡션 + 핵심 메시지. 이미지와 함께 볼 텍스트. 100자 이내 강렬한 메시지.',
  cta: '행동 유도 포스트. "저장해두세요", "팔로우 하면 DM" 등 명확한 CTA.',
}

function getFormatInstruction(format?: ContentFormat): string {
  if (!format) return ''
  return `\n[콘텐츠 포맷: ${format}]\n${FORMAT_INSTRUCTIONS[format]}`
}

// ─── 제품/주제 정보 빌더 ────────────────────────────────────────────────────

function buildProductInfo(product: AffiliateProduct | null, topic: string): string {
  if (!product) return `주제: ${topic}`
  return `제품명: ${product.name}
카테고리: ${product.category}
가격: ${product.price ? `${product.price.toLocaleString()}원` : '미정'}${product.originalPrice && product.price ? ` (원가 ${product.originalPrice.toLocaleString()}원, ${Math.round((1 - product.price / product.originalPrice) * 100)}% 할인)` : ''}
설명: ${product.description ?? '없음'}
키워드: ${product.hookKeywords?.join(', ') ?? '없음'}`
}

// ─── 후킹 생성 프롬프트 ─────────────────────────────────────────────────────

export function buildHookGenerationPrompt(
  product: AffiliateProduct | null,
  topic: string,
  strategy: StrategyConfig
): string {
  const layers = buildPromptLayers(strategy)
  const productInfo = buildProductInfo(product, topic)

  return `당신은 한국 스레드(Threads) 어필리에이트 마케팅 전문 카피라이터입니다.

${layers}

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

// ─── 대본 생성 프롬프트 ─────────────────────────────────────────────────────

export function buildDraftGenerationPrompt(
  product: AffiliateProduct | null,
  topic: string,
  selectedHook: string,
  replyCount: number,
  strategy: StrategyConfig,
  contentFormat?: ContentFormat
): string {
  const layers = buildPromptLayers(strategy)
  const productInfo = product
    ? `제품: ${product.name} | ${product.category} | ${product.price ? `${product.price.toLocaleString()}원` : ''}
설명: ${product.description ?? '없음'}
어필리에이트 링크: ${product.url}`
    : `주제: ${topic}`

  const formatGuide = getFormatInstruction(contentFormat)

  const replyGuides = [
    `"reply1": "핵심 정보 3가지 (이모지 활용, 줄바꿈으로 구분, 200자 이내)"`,
    `"reply2": "추가 팁 또는 실제 사용 예시 (200자 이내)"`,
    `"reply3": "CTA + 링크 안내\\n↓ 링크는 여기\\n[상품 바로가기] → (링크는 별도 댓글로 달 예정이라고 안내, 실제 URL 미포함, 200자 이내)"`,
  ].slice(0, replyCount)

  return `당신은 한국 스레드(Threads) 콘텐츠 전문 작가입니다.

${layers}
${formatGuide}

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
- 이모지는 강조용으로만 1~3개
- 최근 포스트와 유사한 표현/구조 사용 금지`
}

// ─── 인게이지먼트 댓글 생성 프롬프트 ────────────────────────────────────────

export function buildEngagementCommentPrompt(
  postText: string,
  accountNiche: string,
  strategy: StrategyConfig
): string {
  const voice = strategy.brandVoice || '친근한 반말, 자연스러운 한국어'

  return `당신은 Threads에서 ${accountNiche} 분야의 활발한 사용자입니다.

[톤 & 보이스]
${voice}

[대상 포스트]
${postText}

위 포스트에 달 자연스러운 댓글을 1개 생성하세요.

규칙:
- 1~2문장, 50자 이내
- 자기 홍보/링크/해시태그 절대 금지
- 진정성 있는 반응 (공감, 질문, 추가 의견 중 택 1)
- 한국어 구어체, 자연스럽게
- "좋은 글이네요" 같은 뻔한 댓글 금지
- 해당 포스트 내용에 구체적으로 반응

댓글 텍스트만 출력하세요 (따옴표, JSON 없이 순수 텍스트만).`
}
