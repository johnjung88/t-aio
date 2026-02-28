import type { ContentType, PostStatus } from '@/lib/types'
import { z } from '@/lib/zod'

const contentTypeSchema = z.enum(['affiliate', 'informational', 'personal'] as const)
const postStatusSchema = z.enum(['new', 'hooks_ready', 'draft', 'scheduled', 'published'] as const)
const hookTypeSchema = z.enum(['empathy_story', 'price_shock', 'comparison', 'social_proof', 'reverse'] as const)
const affiliatePlatformSchema = z.enum(['coupang', 'naver', 'other'] as const)

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
})

export interface PostCreateInput {
  contentType?: ContentType
  topic?: string
  keywords?: string[]
  account?: string
  affiliateProductId?: string
  notes?: string
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
}

export const postCreateBodySchema = z.object({
  contentType: contentTypeSchema.optional(),
  topic: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  account: z.string().optional(),
  affiliateProductId: z.string().optional(),
  notes: z.string().optional(),
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
  }
}
