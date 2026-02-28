// T-AIO — Core TypeScript Interfaces

export type PostStatus = 'new' | 'hooks_ready' | 'draft' | 'scheduled' | 'published'
export type ContentType = 'affiliate' | 'informational' | 'personal'
export type AffiliatePlatform = 'coupang' | 'naver' | 'other'

// ★ CCG 인사이트 반영: 한국 어필리에이트 특화 5각도
export type HookType = 'empathy_story' | 'price_shock' | 'comparison' | 'social_proof' | 'reverse'

export interface ThreadPost {
  id: string
  createdAt: string
  updatedAt: string
  status: PostStatus
  contentType: ContentType
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
}

export interface SchedulerJob {
  accountId: string
  cronExpression: string
  lastRunAt?: string
}
