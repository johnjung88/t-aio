// T-AIO — Core TypeScript Interfaces

export type PostStatus = 'new' | 'hooks_ready' | 'draft' | 'scheduled' | 'published'
export type ContentType = 'affiliate' | 'informational' | 'personal'
export type AffiliatePlatform = 'coupang' | 'naver' | 'other'

// v2: 7가지 콘텐츠 포맷 (알고리즘 최적화용 A/B 테스트)
export type ContentFormat = 'hook_opinion' | 'question' | 'poll' | 'tip_value' | 'story' | 'image_text' | 'cta'

// ★ CCG 인사이트 반영: 한국 어필리에이트 특화 5각도
export type HookType = 'empathy_story' | 'price_shock' | 'comparison' | 'social_proof' | 'reverse'

// v2: 인게이지먼트 엔진 타입
export type EngagementAction = 'comment' | 'like' | 'follow'
export type EngagementStatus = 'pending' | 'completed' | 'failed'

export interface ThreadPost {
  id: string
  createdAt: string
  updatedAt: string
  status: PostStatus
  contentType: ContentType
  contentFormat?: ContentFormat  // v2: 콘텐츠 포맷
  topic: string
  keywords: string[]
  account: string
  scheduledAt?: string
  publishedAt?: string
  publishedUrl?: string
  // 댓글 자동 추가 상태 (랜덤 딜레이 후 실행)
  commentScheduledAt?: string   // 본글 발행 후 랜덤 딜레이 시각
  commentPostedAt?: string      // 실제 댓글 게시 완료 시각
  thread: {
    main: string
    reply1?: string
    reply2?: string
    reply3?: string
  }
  affiliateProductId?: string
  hookAngles?: HookAngle[]
  selectedHook?: string
  notes?: string
  replyCount?: number
  // v2: 성과 추적
  performanceHistory?: PostPerformance[]
}

export interface HookAngle {
  type: HookType
  label: string
  angle: string
  strength: 1 | 2 | 3 | 4 | 5
}

export interface AffiliateProduct {
  id: string
  createdAt: string
  updatedAt: string
  name: string
  url: string
  platform: AffiliatePlatform
  category: string
  price?: number
  originalPrice?: number
  description?: string
  hookKeywords?: string[]
  useCount: number
  lastUsedAt?: string
}

export interface Account {
  id: string
  createdAt: string
  updatedAt: string
  username: string
  displayName: string
  niche: string
  timezone: string
  dailyPostTarget: number
  autoGenEnabled: boolean
  autoGenTime: string         // "HH:MM"
  categories: string[]
  // Rate limit 추적
  todayPostCount: number      // 오늘 발행 수
  todayPostDate: string       // YYYY-MM-DD (날짜 바뀌면 리셋)
  // 브라우저 자동화 로그인 정보
  loginMethod: 'direct' | 'google'
  loginEmail?: string
  loginPassword?: string
}

export interface StrategyConfig {
  systemPromptBase: string
  hookFormulas: string[]
  optimalPostLength: number
  hashtagStrategy: string
  bestPostTimes: string[]
  replyCount: 0 | 1 | 2 | 3
  // 댓글 딜레이 설정 (봇 탐지 회피)
  commentDelayMin: number     // 최소 딜레이(초), 기본 20
  commentDelayMax: number     // 최대 딜레이(초), 기본 90
  // v2: 6레이어 프롬프트
  persona?: string              // Layer 1: 페르소나 정의
  targetAudience?: string       // Layer 2: 타겟 오디언스
  brandVoice?: string           // Layer 3: 톤 & 보이스
  contentRules?: string[]       // Layer 4: 콘텐츠 규칙
  platformRules?: string[]      // Layer 5: 플랫폼 규칙
  examplePosts?: string[]       // Layer 6: 예시 포스트
  // v2: 스마트 스케줄링 (요일별 포스트 수 [월,화,수,목,금,토,일])
  weekdayPostCounts?: number[]
  // v2: 인게이지먼트 설정
  engagementEnabled?: boolean
  dailyCommentTarget?: number   // 타인 포스트 댓글 일일 목표
  dailyLikeTarget?: number
  dailyFollowTarget?: number
  engagementKeywords?: string[] // 타겟 포스트 검색 키워드
  // v2: 콘텐츠 포맷별 비율 (합 100)
  contentFormatWeights?: Partial<Record<ContentFormat, number>>
}

export interface SchedulerJob {
  accountId: string
  cronExpression: string
  lastRunAt?: string
}

// v2: 인게이지먼트 태스크
export interface EngagementTask {
  id: string
  createdAt: string
  updatedAt: string
  accountId: string
  action: EngagementAction
  targetUrl: string
  targetUsername?: string
  commentText?: string
  status: EngagementStatus
  executedAt?: string
  error?: string
}

// v2: 성과 추적
export interface PostPerformance {
  postId: string
  collectedAt: string
  likes: number
  replies: number
  reposts: number
  views?: number
}

// v2: 경쟁자 분석
export interface Competitor {
  id: string
  createdAt: string
  updatedAt: string
  username: string
  displayName?: string
  niche: string
  trackingEnabled: boolean
  lastScrapedAt?: string
}

export interface CompetitorPost {
  id: string
  competitorId: string
  collectedAt: string
  url: string
  text: string
  likes: number
  replies: number
  reposts: number
}
