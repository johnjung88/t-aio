'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ThreadPost, Account, EngagementTask, PostPerformance, StrategyConfig } from '@/lib/types'

const STATUS_COLS = [
  { key: 'new',         label: '신규',     cls: 'tag-new'       },
  { key: 'hooks_ready', label: '후킹완료', cls: 'tag-hooks'     },
  { key: 'draft',       label: '초안완료', cls: 'tag-draft'     },
  { key: 'scheduled',   label: '예약됨',   cls: 'tag-scheduled' },
  { key: 'published',   label: '발행완료', cls: 'tag-published' },
] as const

const DAILY_LIMIT = 250

function RateLimitMeter({ account }: { account: Account }) {
  const today = new Date().toISOString().slice(0, 10)
  const count = account.todayPostDate === today ? (account.todayPostCount ?? 0) : 0
  const pct = Math.min((count / DAILY_LIMIT) * 100, 100)
  const remaining = DAILY_LIMIT - count
  const color = pct > 80 ? 'var(--red)' : pct > 60 ? 'var(--orange)' : 'var(--mint)'

  return (
    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-s)', fontWeight: 600 }}>{account.displayName}</span>
        <span style={{ fontSize: 11, color: pct > 80 ? 'var(--red)' : 'var(--text-m)' }}>
          {count} / {DAILY_LIMIT}
          {pct > 80 && ' ⚠️'}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-m)' }}>
        잔여 {remaining}건 · 매일 자정 리셋
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [posts, setPosts] = useState<ThreadPost[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('all')
  const [schedulerJobs, setSchedulerJobs] = useState<Array<{
    accountId: string
    running: boolean
    engagementRunning: boolean
    performanceRunning: boolean
  }>>([])
  const [engagements, setEngagements] = useState<EngagementTask[]>([])
  const [performance, setPerformance] = useState<PostPerformance[]>([])
  const [strategy, setStrategy] = useState<StrategyConfig | null>(null)
  const [autopilotLoading, setAutopilotLoading] = useState(false)
  const [autopilotError, setAutopilotError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/posts').then(r => r.json()),
      fetch('/api/accounts').then(r => r.json()),
      fetch('/api/scheduler').then(r => r.json()),
      fetch('/api/engagement').then(r => r.json()),
      fetch('/api/performance').then(r => r.json()),
      fetch('/api/strategy').then(r => r.json()),
    ]).then(([postsRes, accsRes, schedRes, engRes, perfRes, strRes]) => {
      setPosts(postsRes.data ?? [])
      setAccounts(accsRes.data ?? [])
      setSchedulerJobs(schedRes.data?.jobs ?? [])
      setEngagements(engRes.data ?? [])
      setPerformance(perfRes.data ?? [])
      setStrategy(strRes.data ?? null)
    }).catch(() => {})
  }, [])

  async function handleAutopilot(action: 'syncAll' | 'stopAll') {
    setAutopilotLoading(true)
    setAutopilotError(null)
    try {
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setAutopilotError(data.error?.message ?? '오토파일럿 실행 실패')
        return
      }
      // Refresh scheduler status
      const schedRes = await fetch('/api/scheduler').then(r => r.json())
      setSchedulerJobs(schedRes.data?.jobs ?? [])
    } catch (e) {
      setAutopilotError('네트워크 오류가 발생했습니다')
      console.error('[Dashboard] Autopilot action failed:', e)
    } finally {
      setAutopilotLoading(false)
    }
  }

  const filtered = selectedAccount === 'all' ? posts : posts.filter((p) => p.account === selectedAccount)
  const today = new Date().toDateString()
  const todayScheduled = filtered.filter(
    (p) => p.status === 'scheduled' && p.scheduledAt && new Date(p.scheduledAt).toDateString() === today
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>대시보드</h1>
          <div style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 4 }}>{posts.length}개 포스트 · {accounts.length}개 계정</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="input" style={{ width: 160 }} value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
            <option value="all">전체 계정</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
          </select>
          <Link href="/posts/new" className="btn btn-primary">+ 새 포스트</Link>
        </div>
      </div>

      {/* Today scheduled */}
      {todayScheduled.length > 0 && (
        <div className="card card-glow" style={{ marginBottom: 16 }}>
          <div className="section-title"><span className="pulse" />오늘 발행 예정 ({todayScheduled.length}개)</div>
          {todayScheduled.map((p) => (
            <Link key={p.id} href={`/posts/${p.id}/publish`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--gold-l)', minWidth: 40 }}>
                {p.scheduledAt ? new Date(p.scheduledAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
              </span>
              <span style={{ color: 'var(--text)', fontSize: 12, flex: 1 }}>{p.topic.slice(0, 40)}{p.topic.length > 40 ? '…' : ''}</span>
              <span className="tag tag-scheduled">{p.account}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Full Autopilot 제어 패널 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">🤖 Full Autopilot</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <button
            className="btn btn-primary"
            disabled={autopilotLoading}
            onClick={() => handleAutopilot('syncAll')}
            style={{ flex: 1 }}
          >
            {autopilotLoading ? '처리 중...' : '▶ 전체 시작'}
          </button>
          <button
            className="btn btn-danger"
            disabled={autopilotLoading}
            onClick={() => handleAutopilot('stopAll')}
            style={{ flex: 1 }}
          >
            {autopilotLoading ? '처리 중...' : '■ 전체 중지'}
          </button>
        </div>
        {autopilotError && (
          <div style={{ fontSize: 12, color: 'var(--orange)', marginBottom: 12 }}>
            ⚠ {autopilotError}
          </div>
        )}
        {/* 계정별 3종 크론 상태 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {accounts.map((a) => {
            const job = schedulerJobs.find(j => j.accountId === a.id)
            const dots = [
              { label: '자동생성', active: job?.running ?? false, color: 'var(--primary)' },
              { label: '인게이지먼트', active: job?.engagementRunning ?? false, color: 'var(--mint)' },
              { label: '성과수집', active: job?.performanceRunning ?? false, color: 'var(--orange)' },
            ]
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-s)' }}>{a.displayName}</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  {dots.map(({ label, active, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? color : 'var(--text-m)', display: 'inline-block' }} />
                      <span style={{ fontSize: 10, color: active ? color : 'var(--text-m)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {accounts.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-m)' }}>계정 없음</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* ★ Rate Limit 미터 (CCG 인사이트 4번) */}
        <div className="card">
          <div className="section-title">📊 일일 발행 한도 (Threads API 250/24h)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {accounts.map((a) => <RateLimitMeter key={a.id} account={a} />)}
            {accounts.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-m)' }}>계정 없음</div>}
          </div>
        </div>

        {/* 자동생성 상태 */}
        <div className="card">
          <div className="section-title">⚙️ 자동생성 상태</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {accounts.map((a) => {
              const isActive = schedulerJobs.find(j => j.accountId === a.id)?.running ?? false
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? 'var(--mint)' : 'var(--text-m)', display: 'inline-block' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-s)' }}>{a.displayName}</span>
                  </div>
                  <span style={{ fontSize: 11, color: isActive ? 'var(--mint)' : 'var(--text-m)' }}>
                    {isActive ? `ON · ${a.autoGenTime}` : 'OFF'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* v2: Engagement + Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 인게이지먼트 요약 */}
        <div className="card">
          <div className="section-title">💬 오늘 인게이지먼트</div>
          {(() => {
            const todayStr = new Date().toISOString().slice(0, 10)
            const todayEng = engagements.filter(e => e.status === 'completed' && e.createdAt?.startsWith(todayStr))
            const comments = todayEng.filter(e => e.action === 'comment').length
            const likes = todayEng.filter(e => e.action === 'like').length
            const follows = todayEng.filter(e => e.action === 'follow').length
            const targets = [
              { label: '댓글', count: comments, target: strategy?.dailyCommentTarget ?? 10, color: 'var(--primary)' },
              { label: '좋아요', count: likes, target: strategy?.dailyLikeTarget ?? 20, color: 'var(--mint)' },
              { label: '팔로우', count: follows, target: strategy?.dailyFollowTarget ?? 5, color: 'var(--orange)' },
            ]
            return (
              <div style={{ display: 'flex', gap: 12 }}>
                {targets.map(({ label, count, target, color }) => (
                  <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color }}>{count}<span style={{ fontSize: 11, color: 'var(--text-m)' }}>/{target}</span></div>
                    <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 2 }}>{label}</div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 4 }}>
                      <div style={{ height: '100%', width: `${Math.min((count / target) * 100, 100)}%`, background: color, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* TOP 성과 포스트 */}
        <div className="card">
          <div className="section-title">🏆 TOP 성과 포스트</div>
          {(() => {
            // 최신 성과 데이터에서 좋아요 기준 상위 3개
            const postMap = new Map<string, PostPerformance>()
            for (const p of performance) {
              const existing = postMap.get(p.postId)
              if (!existing || p.collectedAt > existing.collectedAt) {
                postMap.set(p.postId, p)
              }
            }
            const top = Array.from(postMap.values())
              .sort((a, b) => (b.likes + b.replies + b.reposts) - (a.likes + a.replies + a.reposts))
              .slice(0, 3)

            if (top.length === 0) {
              return <div style={{ fontSize: 12, color: 'var(--text-m)' }}>성과 데이터 없음</div>
            }
            return top.map((perf, i) => {
              const post = posts.find(p => p.id === perf.postId)
              return (
                <div key={perf.postId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < top.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? 'var(--primary)' : 'var(--text-m)', minWidth: 20 }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post?.topic ?? perf.postId.slice(0, 8)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 10, flexShrink: 0 }}>
                    <span style={{ color: 'var(--primary)' }}>❤ {perf.likes}</span>
                    <span style={{ color: 'var(--mint)' }}>💬 {perf.replies}</span>
                    <span style={{ color: 'var(--orange)' }}>🔄 {perf.reposts}</span>
                  </div>
                </div>
              )
            })
          })()}
        </div>
      </div>

      {/* Kanban */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {STATUS_COLS.map(({ key, label, cls }) => {
          const colPosts = filtered.filter((p) => p.status === key)
          return (
            <div key={key} className="card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className={`tag ${cls}`}>{label}</span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{colPosts.length}</span>
              </div>
              {colPosts.slice(0, 5).map((p) => (
                <Link key={p.id} href={`/posts/${p.id}/draft`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 6, cursor: 'pointer' }}>
                    <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 3 }}>{p.topic.slice(0, 35)}{p.topic.length > 35 ? '…' : ''}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-m)' }}>{new Date(p.createdAt).toLocaleDateString('ko-KR')}</div>
                  </div>
                </Link>
              ))}
              {colPosts.length > 5 && <div style={{ fontSize: 10, color: 'var(--text-m)', textAlign: 'center' }}>+{colPosts.length - 5}개</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
