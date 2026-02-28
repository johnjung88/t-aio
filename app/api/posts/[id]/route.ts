import { NextRequest, NextResponse } from 'next/server'
import { readStore, writeStore } from '@/lib/store'
import type { ThreadPost } from '@/lib/types'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const posts = readStore<ThreadPost[]>('posts', [])
  const post = posts.find((p) => p.id === params.id)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(post)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const posts = readStore<ThreadPost[]>('posts', [])
  const idx = posts.findIndex((p) => p.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  posts[idx] = { ...posts[idx], ...body }
  writeStore('posts', posts)

  return NextResponse.json(posts[idx])
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const posts = readStore<ThreadPost[]>('posts', [])
  const filtered = posts.filter((p) => p.id !== params.id)
  writeStore('posts', filtered)
  return NextResponse.json({ ok: true })
}
