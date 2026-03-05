import type { ContentType, ContentFormat, PostStatus } from '@/lib/types'
import { z } from '@/lib/zod'

const contentTypeSchema = z.enum(['affiliate', 'informational', 'personal'] as const)
const contentFormatSchema = z.enum(['hook_opinion', 'question', 'poll', 'tip_value', 'story', 'image_text', 'cta'] as const)
const postStatusSchema = z.enum(['new', 'hooks_ready', 'draft', 'scheduled', 'published'] as const)
const hookTypeSchema = z.enum(['empathy_story', 'price_shock', 'comparison', 'social_proof', 'reverse'] as const)
const affiliatePlatformSchema = z.enum(['coupang', 'naver', 'other'] as const)
const engagementActionSchema = z.enum(['comment', 'like', 'follow'] as const)
// Used for type validation reference
const _engagementStatusSchema = z.enum(['pending', 'completed', 'failed'] as const)
void _engagementStatusSchema

const threadSchema = z.object({
  main: z.string(),
  reply1: z.string().optional(),
  reply2: z.string().optional(),
  reply3: z.string().optional(),
})

const hookAngleSchema = z.object({
  type: hookTypeSchema,
  label: z.string(),
  angle: z.string(),
  strength: z.number().int().min(1).max(5),
})

const postPatchSchema = z.object({
  status: postStatusSchema.optional(),
  contentType: contentTypeSchema.optional(),
  contentFormat: contentFormatSchema.optional(),
  topic: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  account: z.string().optional(),
  scheduledAt: z.string().optional(),
  publishedAt: z.string().optional(),
  publishedUrl: z.string().optional(),
  commentScheduledAt: z.string().optional(),
  commentPostedAt: z.string().optional(),
  thread: threadSchema.optional(),
  affiliateProductId: z.string().optional(),
  hookAngles: z.array(hookAngleSchema).optional(),
  selectedHook: z.string().optional(),
  notes: z.string().optional(),
})

const productPatchSchema = z.object({
  name: z.string().optional(),
  url: z.string().url().optional(),
  platform: affiliatePlatformSchema.optional(),
  category: z.string().optional(),
  price: z.number().int().optional(),
  originalPrice: z.number().int().optional(),
  description: z.string().optional(),
  hookKeywords: z.array(z.string()).optional(),
  useCount: z.number().int().min(0).optional(),
  lastUsedAt: z.string().optional(),
})

const accountPatchSchema = z.object({
  username: z.string().optional(),
  displayName: z.string().optional(),
  niche: z.string().optional(),
  timezone: z.string().optional(),
  dailyPostTarget: z.number().int().min(0).optional(),
  autoGenEnabled: z.boolean().optional(),
  autoGenTime: z.string().optional(),
  categories: z.array(z.string()).optional(),
  todayPostCount: z.number().int().min(0).optional(),
  todayPostDate: z.string().optional(),
  loginMethod: z.enum(['direct', 'google'] as const).optional(),
  loginEmail: z.string().email().optional(),
  loginPassword: z.string().optional(),
})

const strategySchema = z.object({
  systemPromptBase: z.string(),
  hookFormulas: z.array(z.string()),
  optimalPostLength: z.number().int().min(1).max(500),
  hashtagStrategy: z.string(),
  bestPostTimes: z.array(z.string()),
  replyCount: z.number().int().min(0).max(3),
  commentDelayMin: z.number().int().min(1),
  commentDelayMax: z.number().int().min(1),
  // v2: 6레이어 프롬프트 (모두 optional — 하위 호환)
  persona: z.string().optional(),
  targetAudience: z.string().optional(),
  brandVoice: z.string().optional(),
  contentRules: z.array(z.string()).optional(),
  platformRules: z.array(z.string()).optional(),
  examplePosts: z.array(z.string()).optional(),
  // v2: 스마트 스케줄링
  weekdayPostCounts: z.array(z.number().int().min(0)).length(7).optional(),
  // v2: 인게이지먼트
  engagementEnabled: z.boolean().optional(),
  dailyCommentTarget: z.number().int().min(0).optional(),
  dailyLikeTarget: z.number().int().min(0).optional(),
  dailyFollowTarget: z.number().int().min(0).optional(),
  engagementKeywords: z.array(z.string()).optional(),
  // v2: 콘텐츠 포맷 비율
  contentFormatWeights: z.record(contentFormatSchema, z.number().min(0)).optional(),
})

export interface PostCreateInput {
  contentType?: ContentType
  contentFormat?: ContentFormat
  topic?: string
  keywords?: string[]
  account?: string
  affiliateProductId?: string
  notes?: string
  replyCount?: number
}

export interface ProductCreateInput {
  name: string
  url: string
  platform?: 'coupang' | 'naver' | 'other'
  category?: string
  price?: number
  originalPrice?: number
  description?: string
  hookKeywords?: string[]
}

export interface AccountCreateInput {
  username: string
  displayName?: string
  niche?: string
  timezone?: string
  dailyPostTarget?: number
  autoGenTime?: string
  categories?: string[]
  loginMethod?: 'direct' | 'google'
  loginEmail?: string
  loginPassword?: string
}

export interface GenerateHookInput {
  postId: string
}

export interface GenerateDraftInput {
  postId: string
  replyCount?: number
}

export interface SchedulerActionInput {
  action: 'start' | 'stop'
  accountId: string
  time?: string
}

export interface ScrapeInput {
  url: string
}

export interface PostQueryInput {
  status?: PostStatus
  account?: string
}

export interface ProductSuggestQueryInput {
  accountId: string
}

export interface StrategyInput {
  systemPromptBase: string
  hookFormulas: string[]
  optimalPostLength: number
  hashtagStrategy: string
  bestPostTimes: string[]
  replyCount: 0 | 1 | 2 | 3
  commentDelayMin: number
  commentDelayMax: number
  // v2 optional fields
  persona?: string
  targetAudience?: string
  brandVoice?: string
  contentRules?: string[]
  platformRules?: string[]
  examplePosts?: string[]
  weekdayPostCounts?: number[]
  engagementEnabled?: boolean
  dailyCommentTarget?: number
  dailyLikeTarget?: number
  dailyFollowTarget?: number
  engagementKeywords?: string[]
  contentFormatWeights?: Partial<Record<ContentFormat, number>>
}

export interface EngagementCreateInput {
  accountId: string
  action: 'comment' | 'like' | 'follow'
  targetUrl: string
  targetUsername?: string
  commentText?: string
}

export interface EngagementExecuteInput {
  accountId: string
  limit?: number
}

export interface EngagementFindPostsInput {
  accountId: string
  keyword: string
  limit?: number
}

export interface CompetitorCreateInput {
  username: string
  displayName?: string
  niche: string
}

export interface PerformanceCollectInput {
  accountId: string
  postId?: string
}

export const postCreateBodySchema = z.object({
  contentType: contentTypeSchema.optional(),
  contentFormat: contentFormatSchema.optional(),
  topic: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  account: z.string().optional(),
  affiliateProductId: z.string().optional(),
  notes: z.string().optional(),
  replyCount: z.number().int().min(0).max(3).optional(),
})

export const postPatchBodySchema = postPatchSchema

export const productCreateBodySchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  platform: affiliatePlatformSchema.optional(),
  category: z.string().optional(),
  price: z.number().int().optional(),
  originalPrice: z.number().int().optional(),
  description: z.string().optional(),
  hookKeywords: z.array(z.string()).optional(),
})

export const productPatchBodySchema = productPatchSchema

export const accountCreateBodySchema = z.object({
  username: z.string().min(1),
  displayName: z.string().optional(),
  niche: z.string().optional(),
  timezone: z.string().optional(),
  dailyPostTarget: z.number().int().min(0).optional(),
  autoGenTime: z.string().optional(),
  categories: z.array(z.string()).optional(),
  loginMethod: z.enum(['direct', 'google'] as const).optional(),
  loginEmail: z.string().email().optional(),
  loginPassword: z.string().optional(),
})

export const accountPatchBodySchema = accountPatchSchema

export const strategyBodySchema = strategySchema

export const generateHookBodySchema = z.object({
  postId: z.string().min(1),
})

export const generateDraftBodySchema = z.object({
  postId: z.string().min(1),
  replyCount: z.number().int().min(0).max(3).optional(),
})

export const schedulerBodySchema = z.object({
  action: z.enum(['start', 'stop'] as const),
  accountId: z.string().min(1),
  time: z.string().optional(),
})

export const scrapeBodySchema = z.object({
  url: z.string().url(),
})

export function parsePostQuery(input: { status: string | null; account: string | null }): PostQueryInput {
  const statusValues: PostStatus[] = ['new', 'hooks_ready', 'draft', 'scheduled', 'published']
  const status = statusValues.find((value) => value === input.status)
  return {
    status,
    account: input.account ?? undefined,
  }
}

export function parseProductSuggestQuery(input: { accountId: string | null }): ProductSuggestQueryInput {
  return {
    accountId: input.accountId ?? 'default',
  }
}

export function parseStrategyInput(input: StrategyInput): StrategyInput {
  return {
    systemPromptBase: input.systemPromptBase,
    hookFormulas: input.hookFormulas,
    optimalPostLength: input.optimalPostLength,
    hashtagStrategy: input.hashtagStrategy,
    bestPostTimes: input.bestPostTimes,
    replyCount: input.replyCount,
    commentDelayMin: input.commentDelayMin,
    commentDelayMax: input.commentDelayMax,
    // v2 fields
    persona: input.persona,
    targetAudience: input.targetAudience,
    brandVoice: input.brandVoice,
    contentRules: input.contentRules,
    platformRules: input.platformRules,
    examplePosts: input.examplePosts,
    weekdayPostCounts: input.weekdayPostCounts,
    engagementEnabled: input.engagementEnabled,
    dailyCommentTarget: input.dailyCommentTarget,
    dailyLikeTarget: input.dailyLikeTarget,
    dailyFollowTarget: input.dailyFollowTarget,
    engagementKeywords: input.engagementKeywords,
    contentFormatWeights: input.contentFormatWeights,
  }
}

// v2: 인게이지먼트 스키마
export const engagementCreateBodySchema = z.object({
  accountId: z.string().min(1),
  action: engagementActionSchema,
  targetUrl: z.string().url(),
  targetUsername: z.string().optional(),
  commentText: z.string().optional(),
})

export const engagementExecuteBodySchema = z.object({
  accountId: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional(),
})

export const engagementFindPostsBodySchema = z.object({
  accountId: z.string().min(1),
  keyword: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional(),
})

// v2: 경쟁자 스키마
export const competitorCreateBodySchema = z.object({
  username: z.string().min(1),
  displayName: z.string().optional(),
  niche: z.string().min(1),
})

export const competitorPatchBodySchema = z.object({
  displayName: z.string().optional(),
  niche: z.string().optional(),
  trackingEnabled: z.boolean().optional(),
})

// v2: 성과 수집 스키마
export const performanceCollectBodySchema = z.object({
  accountId: z.string().min(1),
  postId: z.string().optional(),
})
