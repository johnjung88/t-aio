import { NextRequest } from 'next/server'
import { fail, ok, zodErrorDetails } from '@/lib/api'
import { normalizePosts } from '@/lib/entities'
import { removeUndefined } from '@/lib/object'
import { postPatchBodySchema } from '@/lib/schemas'
import { readStore, writeStore } from '@/lib/store'
import type { ThreadPost } from '@/lib/types'

interface Context {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: Context) {
  const posts = normalizePosts(readStore<ThreadPost[]>('posts', []))
  writeStore('posts', posts)

  const post = posts.find((item) => item.id === params.id)
  if (!post) return fail('Post not found', 404, 'NOT_FOUND')
  return ok(post)
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const rawBody: unknown = await req.json()
  const parsed = postPatchBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail('Invalid request body', 400, 'VALIDATION_ERROR', zodErrorDetails(parsed.error))
  }

  const posts = normalizePosts(readStore<ThreadPost[]>('posts', []))
  const index = posts.findIndex((item) => item.id === params.id)
  if (index === -1) return fail('Post not found', 404, 'NOT_FOUND')

  const updates = removeUndefined(parsed.data as Record<string, unknown>)

  posts[index] = {
    ...posts[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  writeStore('posts', posts)
  return ok(posts[index])
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const posts = normalizePosts(readStore<ThreadPost[]>('posts', []))
  const exists = posts.some((item) => item.id === params.id)
  if (!exists) return fail('Post not found', 404, 'NOT_FOUND')

  writeStore('posts', posts.filter((item) => item.id !== params.id))
  return ok({ id: params.id, deleted: true })
}
