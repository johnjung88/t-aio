'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ThreadPost, Account } from '@/lib/types'

const STATUS_COLS = [
  { key: 'new',        label: '신규',     cls: 'tag-new'       },
  { key: 'hooks_ready',label: '후킹완료', cls: 'tag-hooks'     },
  { key: 'draft',      label: '초안완료', cls: 'tag-draft'     },
  { key: 'scheduled',  label: '예약됨',   cls: 'tag-scheduled' },
  { key: 'published',  label: '발행완료', cls: 'tag-published' },
] as const

export default function DashboardPage() {
  const [posts, setPosts] = useState<ThreadPost[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [schedulerStatus, setSchedulerStatus] = useState<{ running: boolean; jobs: { accountId: string }[] }>({ running: false, jobs: [] })

  useEffect(() => {
    fetch('/api/posts').then((r) => r.json()).then(setPosts)
    fetch('/api/accounts').then((r) => r.json()).then(setAccounts)
    fetch('/api/scheduler').then((r) => r.json()).then(setSchedulerStatus)
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
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>대시보드</h1>
          <div style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 4 }}>
            {posts.length}개 포스트 · {accounts.length}개 계정
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Account switcher */}
          <select
            className="input"
            style={{ width: 160 }}
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            <option value="all">전체 계정</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.displayName}</option>
            ))}
          </select>
          <Link href="/posts/new" className="btn btn-primary">+ 새 포스트</Link>
        </div>
      </div>

      {/* Today's scheduled */}
      {todayScheduled.length > 0 && (
        <div className="card card-glow" style={{ marginBottom: 20 }}>
          <div className="section-title">
            <span className="pulse" />
            오늘 발행 예정 ({todayScheduled.length}개)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todayScheduled.map((p) => (
              <Link
                key={p.id}
                href={`/posts/${p.id}/publish`}
                style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
              >
                <span style={{ fontSize: 11, color: 'var(--gold-l)' }}>
                  {p.scheduledAt ? new Date(p.scheduledAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </span>
                <span style={{ color: 'var(--text)', fontSize: 12, flex: 1 }} className="truncate">{p.topic}</span>
                <span className={`tag tag-scheduled`}>{p.account}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Scheduler status */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">자동생성 상태</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {accounts.map((a) => {
            const isActive = schedulerStatus.jobs.some((j) => j.accountId === a.id)
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isActive ? 'var(--mint)' : 'var(--text-m)',
                }} />
                <span style={{ fontSize: 12, color: isActive ? 'var(--mint)' : 'var(--text-m)' }}>
                  {a.displayName} {isActive ? `(${a.autoGenTime})` : '(OFF)'}
                </span>
              </div>
            )
          })}
          {accounts.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-m)' }}>계정 없음</span>}
        </div>
      </div>

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {STATUS_COLS.map(({ key, label, cls }) => {
          const colPosts = filtered.filter((p) => p.status === key)
          return (
            <div key={key} className="card" style={{ padding: '14px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className={`tag ${cls}`}>{label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{colPosts.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colPosts.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={`/posts/${p.id}/draft`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 4 }}
                           className="overflow-hidden" title={p.topic}>
                        {p.topic.length > 35 ? p.topic.slice(0, 35) + '…' : p.topic}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-m)' }}>
                        {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  </Link>
                ))}
                {colPosts.length > 5 && (
                  <div style={{ fontSize: 10, color: 'var(--text-m)', textAlign: 'center' }}>
                    +{colPosts.length - 5}개 더
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
