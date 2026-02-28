'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { ThreadPost, Account } from '@/lib/types'

export default function SchedulePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<ThreadPost | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [account, setAccount] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/${id}`).then((r) => r.json()).then((p: ThreadPost) => {
      setPost(p)
      setAccount(p.account)
      if (p.scheduledAt) setScheduledAt(new Date(p.scheduledAt).toISOString().slice(0, 16))
    })
    fetch('/api/accounts').then((r) => r.json()).then(setAccounts)
  }, [id])

  async function handleSchedule() {
    if (!scheduledAt) return alert('날짜/시간을 선택하세요')
    setSaving(true)
    try {
      await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account,
          scheduledAt: new Date(scheduledAt).toISOString(),
          status: 'scheduled',
        }),
      })
      router.push(`/posts/${id}/publish`)
    } finally {
      setSaving(false)
    }
  }

  if (!post) return <div style={{ color: 'var(--text-m)' }}>로딩 중...</div>

  return (
    <div style={{ maxWidth: 500 }}>
      <div style={{ fontSize: 11, color: 'var(--text-m)', marginBottom: 8 }}>
        포스트 &gt; {post.topic} &gt; <span style={{ color: 'var(--primary)' }}>예약 설정</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Step 4 — 예약 설정</h1>
        <div style={{ padding: '4px 10px', background: 'rgba(0,212,255,0.08)', borderRadius: 20, fontSize: 11, color: 'var(--primary)' }}>4 / 5</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div className="section-title">계정 선택</div>
          <select className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.displayName} ({a.niche})</option>
            ))}
          </select>
        </div>

        <div>
          <div className="section-title">발행 날짜 / 시간</div>
          <input
            type="datetime-local"
            className="input"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>

        {/* Best times hint */}
        <div style={{ padding: '10px 14px', background: 'rgba(0,200,150,0.06)', borderRadius: 8, fontSize: 11, color: 'var(--gold-l)' }}>
          💡 최적 발행 시간대: 오전 7-9시, 오후 12-1시, 저녁 9-11시
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => router.back()}>이전</button>
          <button className="btn btn-primary" onClick={handleSchedule} disabled={saving}>
            {saving ? '저장 중...' : '발행 헬퍼 →'}
          </button>
        </div>
      </div>
    </div>
  )
}
