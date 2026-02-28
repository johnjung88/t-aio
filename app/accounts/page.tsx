'use client'
import { useEffect, useState } from 'react'
import type { Account } from '@/lib/types'

const DAILY_LIMIT = 250

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ username: '', displayName: '', niche: '', dailyPostTarget: 3, autoGenTime: '08:00' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/accounts').then((r) => r.json()).then((res) => setAccounts(res.data ?? []))
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const r = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const res = await r.json()
    const newAcc = res.data ?? res
    setAccounts((prev) => [...prev, newAcc])
    setShowAdd(false)
    setForm({ username: '', displayName: '', niche: '', dailyPostTarget: 3, autoGenTime: '08:00' })
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('계정을 삭제하시겠습니까?')) return
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  const toggleAutoGen = async (account: Account) => {
    const updated = { autoGenEnabled: !account.autoGenEnabled }
    await fetch(`/api/accounts/${account.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, ...updated } : a))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>계정 관리</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">+ 계정 추가</button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '1rem' }}>새 계정 등록</div>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>아이디 (username) *</label>
                <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="@없이 입력"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>표시명</label>
                <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="홍길동의 테크리뷰"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>니치</label>
                <input value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} placeholder="IT/테크, 육아, 뷰티..."
                  style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>자동생성 시간</label>
                <input type="time" value={form.autoGenTime} onChange={(e) => setForm({ ...form, autoGenTime: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">취소</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? '저장중...' : '등록'}</button>
            </div>
          </form>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
          등록된 계정이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {accounts.map((a) => {
            const today = new Date().toISOString().split('T')[0]
            const count = a.todayPostDate === today ? a.todayPostCount : 0
            const pct = Math.min((count / DAILY_LIMIT) * 100, 100)
            const barColor = pct > 80 ? 'var(--red, #ff4444)' : pct > 60 ? 'var(--orange)' : 'var(--mint)'

            return (
              <div key={a.id} className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.displayName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>@{a.username} · {a.niche}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {/* 자동생성 토글 */}
                    <button
                      onClick={() => toggleAutoGen(a)}
                      style={{
                        padding: '0.35rem 0.85rem', borderRadius: '999px', fontSize: '0.78rem',
                        border: '1px solid',
                        borderColor: a.autoGenEnabled ? 'var(--mint)' : 'var(--border)',
                        background: a.autoGenEnabled ? 'var(--mint)22' : 'transparent',
                        color: a.autoGenEnabled ? 'var(--mint)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {a.autoGenEnabled ? `⚡ 자동 ${a.autoGenTime}` : '자동생성 OFF'}
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      style={{ padding: '0.35rem 0.7rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {/* Rate limit 미터 */}
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>오늘 발행</span>
                    <span style={{ color: barColor, fontWeight: 600 }}>{count} / {DAILY_LIMIT}</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--surface-2)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '2px', transition: 'width 0.3s' }} />
                  </div>
                  {pct > 80 && <div style={{ fontSize: '0.72rem', color: 'var(--red, #ff4444)', marginTop: '0.3rem' }}>⚠ 일일 한도 임박 (자정 리셋)</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
