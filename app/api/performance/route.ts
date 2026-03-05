import { NextRequest } from 'next/server'
import { ok } from '@/lib/api'
import { readStore } from '@/lib/store'
import type { PostPerformance } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const postId = searchParams.get('postId')
  const days = parseInt(searchParams.get('days') ?? '7')

  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  let performances = readStore<PostPerformance[]>('performance', [])
    .filter(p => p.collectedAt >= cutoff)

  if (postId) performances = performances.filter(p => p.postId === postId)

  return ok(performances)
}
