'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ThreadPost, Account } from '@/lib/types'

const STATUS_COLS = [
  { key: 'new',         label: '신규',     cls: 'tag-new'       },
  { key: 'hooks_ready', label: '후킹완료', cls: 'tag-hooks'     },
  { key: 'draft',       label: '초안완료', cls: 'tag-draft'     },
  { key: 'scheduled',   label: '예약됨',   cls: 'tag-scheduled' },
  { key: 'published',   label: '발행완료', cls: 'tag-published' },
] as const

const DAILY_LIMIT = 250

function RateLimitMeter({ account }: { account: Account }) {
  const count = account.todayPostCount ?? 0
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
  const [schedulerJobs, setSchedulerJobs] = useState<{ accountId: string }[]>([])

  useEffect(() => {
    fetch('/api/posts').then((r) => r.json()).then((res) => setPosts(res.data ?? []))
    fetch('/api/accounts').then((r) => r.json()).then((res) => setAccounts(res.data ?? []))
    fetch('/api/scheduler').then((r) => r.json()).then((res) => setSchedulerJobs(res.data?.jobs ?? []))
  }, [])

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
              const isActive = schedulerJobs.some((j) => j.accountId === a.id)
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
