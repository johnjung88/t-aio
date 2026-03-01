import { NextRequest } from 'next/server'
import { ok, fail, zodErrorDetails } from '@/lib/api'
import { normalizePosts } from '@/lib/entities'
import { readStore, writeStore } from '@/lib/store'
import { postCreateBodySchema, parsePostQuery, type PostCreateInput } from '@/lib/schemas'
import type { ThreadPost } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = parsePostQuery({
    status: searchParams.get('status'),
    account: searchParams.get('account'),
  })

  const normalized = normalizePosts(readStore<ThreadPost[]>('posts', []))

  let posts = normalized
  if (query.status) posts = posts.filter((post) => post.status === query.status)
  if (query.account) posts = posts.filter((post) => post.account === query.account)

  posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return ok(posts)
}

export async function POST(req: NextRequest) {
  const rawBody: unknown = await req.json()
  const parsed = postCreateBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const body = parsed.data as PostCreateInput
  const now = new Date().toISOString()
  const posts = normalizePosts(readStore<ThreadPost[]>('posts', []))

  const newPost: ThreadPost = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'new',
    contentType: body.contentType ?? 'informational',
    topic: body.topic ?? '',
    keywords: body.keywords ?? [],
    account: body.account ?? 'default',
    thread: { main: '', reply1: '', reply2: '', reply3: '' },
    affiliateProductId: body.affiliateProductId,
    notes: body.notes,
  }

  posts.push(newPost)
  writeStore('posts', posts)
  return ok(newPost, 201)
}
