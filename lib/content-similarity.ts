// T-AIO — Content Similarity Check (2-gram Jaccard, 외부 패키지 불필요)

import type { ThreadPost } from './types'

function getNgrams(text: string, n: number): Set<string> {
  const cleaned = text.replace(/\s+/g, ' ').trim().toLowerCase()
  const grams = new Set<string>()
  for (let i = 0; i <= cleaned.length - n; i++) {
    grams.add(cleaned.slice(i, i + n))
  }
  return grams
}

export function calculateSimilarity(text1: string, text2: string): number {
  const a = getNgrams(text1, 2)
  const b = getNgrams(text2, 2)
  if (a.size === 0 || b.size === 0) return 0

  let intersection = 0
  Array.from(a).forEach(gram => {
    if (b.has(gram)) intersection++
  })
  return intersection / (a.size + b.size - intersection)
}

export function checkAgainstRecent(
  newText: string,
  posts: ThreadPost[],
  threshold = 0.3,
  days = 30
): { isSimilar: boolean; mostSimilarPost?: ThreadPost; score: number } {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  const recent = posts.filter(
    p => p.thread.main && p.createdAt >= cutoff
  )

  let maxScore = 0
  let mostSimilar: ThreadPost | undefined

  for (const post of recent) {
    const score = calculateSimilarity(newText, post.thread.main)
    if (score > maxScore) {
      maxScore = score
      mostSimilar = post
    }
  }

  return {
    isSimilar: maxScore >= threshold,
    mostSimilarPost: mostSimilar,
    score: maxScore,
  }
}
