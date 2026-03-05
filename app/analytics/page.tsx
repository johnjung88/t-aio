'use client'
import { useEffect, useState } from 'react'
import type { ThreadPost, PostPerformance, Account } from '@/lib/types'

interface PostWithMetrics {
  post: ThreadPost
  latestMetrics?: PostPerformance
}

export default function AnalyticsPage() {
  const [posts, setPosts] = useState<ThreadPost[]>([])
  const [performances, setPerformances] = useState<PostPerformance[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('all')
  const [collecting, setCollecting] = useState(false)
  const [sortBy, setSortBy] = useState<'likes' | 'replies' | 'reposts'>('likes')

  useEffect(() => {
    Promise.all([
      fetch('/api/posts').then(r => r.json()),
      fetch('/api/performance?days=30').then(r => r.json()),
      fetch('/api/accounts').then(r => r.json()),
    ]).then(([postsRes, perfRes, accRes]) => {
      setPosts(postsRes.data ?? [])
      setPerformances(perfRes.data ?? [])
      setAccounts(accRes.data ?? [])
    }).catch(() => {})
  }, [])

  const published = posts.filter(p => p.status === 'published')
  const filtered = selectedAccount === 'all' ? published : published.filter(p => p.account === selectedAccount)

  // 각 포스트의 최신 성과 매핑
  const postsWithMetrics: PostWithMetrics[] = filtered.map(post => {
    const postPerfs = performances.filter(p => p.postId === post.id)
    const latest = postPerfs.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))[0]
    return { post, latestMetrics: latest }
  }).sort((a, b) => {
    const aVal = a.latestMetrics?.[sortBy] ?? 0
    const bVal = b.latestMetrics?.[sortBy] ?? 0
    return bVal - aVal
  })

  // 총합 통계
  const totalLikes = postsWithMetrics.reduce((s, p) => s + (p.latestMetrics?.likes ?? 0), 0)
  const totalReplies = postsWithMetrics.reduce((s, p) => s + (p.latestMetrics?.replies ?? 0), 0)
  const totalReposts = postsWithMetrics.reduce((s, p) => s + (p.latestMetrics?.reposts ?? 0), 0)
  const avgEngagement = postsWithMetrics.length > 0
    ? ((totalLikes + totalReplies + totalReposts) / postsWithMetrics.length).toFixed(1)
    : '0'

  // 후킹 각도별 평균 성과
  const hookStats = postsWithMetrics.reduce((acc, { post, latestMetrics }) => {
    const hookType = post.hookAngles?.find(h => h.angle === post.selectedHook)?.type
    if (!hookType || !latestMetrics) return acc
    if (!acc[hookType]) acc[hookType] = { count: 0, likes: 0, replies: 0 }
    acc[hookType].count++
    acc[hookType].likes += latestMetrics.likes
    acc[hookType].replies += latestMetrics.replies
    return acc
  }, {} as Record<string, { count: number; likes: number; replies: number }>)

  async function handleCollect() {
    const accountId = selectedAccount === 'all' ? accounts[0]?.id : selectedAccount
    if (!accountId) return
    setCollecting(true)
    try {
      await fetch('/api/performance/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      const res = await fetch('/api/performance?days=30').then(r => r.json())
      setPerformances(res.data ?? [])
    } catch {}
    setCollecting(false)
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>성과 분석</h1>
          <p style={{ fontSize: 13, color: 'var(--text-s)' }}>발행 포스트 성과 추적</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12 }}>
            <option value="all">전체 계정</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.displayName}</option>)}
          </select>
          <button onClick={handleCollect} disabled={collecting} className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
            {collecting ? '수집 중...' : '성과 수집'}
          </button>
        </div>
      </div>

      {/* KPI 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: '총 좋아요', value: totalLikes, color: 'var(--primary)' },
          { label: '총 댓글', value: totalReplies, color: 'var(--mint)' },
          { label: '총 리포스트', value: totalReposts, color: 'var(--orange)' },
          { label: '평균 반응', value: avgEngagement, color: 'var(--text)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-s)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 후킹 각도별 성과 */}
      {Object.keys(hookStats).length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>후킹 각도별 평균 성과</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {Object.entries(hookStats).map(([type, stats]) => (
              <div key={type} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 4 }}>{type}</div>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>평균 좋아요: {(stats.likes / stats.count).toFixed(1)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-s)' }}>평균 댓글: {(stats.replies / stats.count).toFixed(1)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-s)' }}>({stats.count}개 포스트)</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 포스트별 성과 테이블 */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>포스트별 성과 ({postsWithMetrics.length}개)</h2>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['likes', 'replies', 'reposts'] as const).map(key => (
              <button key={key} onClick={() => setSortBy(key)}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, border: '1px solid var(--border)', background: sortBy === key ? 'var(--primary)' : 'transparent', color: sortBy === key ? '#000' : 'var(--text-s)', cursor: 'pointer' }}>
                {{ likes: '좋아요', replies: '댓글', reposts: '리포스트' }[key]}
              </button>
            ))}
          </div>
        </div>
        {postsWithMetrics.length === 0 ? (
          <div style={{ color: 'var(--text-s)', fontSize: 13 }}>발행된 포스트 없음</div>
        ) : (
          postsWithMetrics.slice(0, 30).map(({ post, latestMetrics }) => (
            <div key={post.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {post.thread.main?.slice(0, 60) || post.topic}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-s)', marginTop: 2 }}>
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : '-'}
                  {post.contentFormat && <span style={{ marginLeft: 8, color: 'var(--primary)' }}>{post.contentFormat}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, flexShrink: 0 }}>
                <span style={{ color: 'var(--primary)' }}>{latestMetrics?.likes ?? '-'}</span>
                <span style={{ color: 'var(--mint)' }}>{latestMetrics?.replies ?? '-'}</span>
                <span style={{ color: 'var(--orange)' }}>{latestMetrics?.reposts ?? '-'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
