import { NextRequest, NextResponse } from 'next/server'
import { readStore, writeStore } from '@/lib/store'
import type { ThreadPost } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const account = searchParams.get('account')

  let posts = readStore<ThreadPost[]>('posts', [])

  if (status) posts = posts.filter((p) => p.status === status)
  if (account) posts = posts.filter((p) => p.account === account)

  // Sort newest first
  posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json(posts)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const posts = readStore<ThreadPost[]>('posts', [])

  const newPost: ThreadPost = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
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

  return NextResponse.json(newPost, { status: 201 })
}
