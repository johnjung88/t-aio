// T-AIO — Core TypeScript Interfaces

export type PostStatus = 'new' | 'hooks_ready' | 'draft' | 'scheduled' | 'published'
export type ContentType = 'affiliate' | 'informational' | 'personal'
export type AffiliatePlatform = 'coupang' | 'naver' | 'other'

export interface ThreadPost {
  id: string
  createdAt: string
  status: PostStatus
  contentType: ContentType
  topic: string
  keywords: string[]
  account: string
  scheduledAt?: string
  publishedAt?: string
  publishedUrl?: string
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
  type: 'pain' | 'curiosity' | 'number' | 'empathy' | 'comparison'
  label: string
  angle: string
  strength: 1 | 2 | 3 | 4 | 5
}

export interface AffiliateProduct {
  id: string
  createdAt: string
  name: string
  url: string
  platform: AffiliatePlatform
  category: string
  price?: number
  description?: string
  hookKeywords?: string[]
  useCount: number
  lastUsedAt?: string
}

export interface Account {
  id: string
  username: string
  displayName: string
  niche: string
  timezone: string
  dailyPostTarget: number
  autoGenEnabled: boolean
  autoGenTime: string   // "HH:MM" format
  categories: string[]  // preferred product categories
}

export interface StrategyConfig {
  systemPromptBase: string
  hookFormulas: string[]
  optimalPostLength: number
  hashtagStrategy: string
  bestPostTimes: string[]
  replyCount: 0 | 1 | 2 | 3
}

export interface SchedulerStatus {
  running: boolean
  jobs: SchedulerJob[]
}

export interface SchedulerJob {
  accountId: string
  cronExpression: string
  lastRunAt?: string
  nextRunAt?: string
}
