'use client'
import { useEffect, useState } from 'react'
import type { Account } from '@/lib/types'

const NICHES = ['IT/테크', '뷰티/패션', '음식/요리', '육아/교육', '재테크/투자', '여행', '운동/헬스', '일반']

function AccountCard({ account, onUpdate, onDelete }: { account: Account; onUpdate: (id: string, data: Partial<Account>) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(account)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    onUpdate(account.id, form)
    setEditing(false)
    setSaving(false)
  }

  async function toggleAutoGen() {
    setToggling(true)
    const res = await fetch('/api/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', accountId: account.id, time: account.autoGenTime }),
    })
    const data = await res.json()
    onUpdate(account.id, { autoGenEnabled: data.enabled })
    setToggling(false)
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>@{account.username}</span>
              <span className="tag">{account.niche}</span>
              <span className={`tag ${account.autoGenEnabled ? 'tag-published' : 'tag-new'}`}>
                {account.autoGenEnabled ? `자동생성 ON (${account.autoGenTime})` : '자동생성 OFF'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-m)' }}>
              {account.displayName} · 하루 목표: {account.dailyPostTarget}개
              {account.categories.length > 0 && ` · 카테고리: ${account.categories.join(', ')}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={toggleAutoGen} disabled={toggling}>
              {toggling ? '...' : account.autoGenEnabled ? '자동 OFF' : '자동 ON'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>편집</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(account.id)}>삭제</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div className="section-title">사용자명</div>
              <input className="input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <div className="section-title">표시명</div>
              <input className="input" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div className="section-title">니치</div>
              <select className="input" value={form.niche} onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}>
                {NICHES.map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <div className="section-title">하루 목표</div>
              <input type="number" className="input" value={form.dailyPostTarget} onChange={(e) => setForm((f) => ({ ...f, dailyPostTarget: Number(e.target.value) }))} />
            </div>
            <div>
              <div className="section-title">자동생성 시간</div>
              <input type="time" className="input" value={form.autoGenTime} onChange={(e) => setForm((f) => ({ ...f, autoGenTime: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ username: '', displayName: '', niche: 'IT/테크', dailyPostTarget: 2, autoGenTime: '08:00' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/accounts').then((r) => r.json()).then(setAccounts)
  }, [])

  async function addAccount() {
    if (!form.username) return alert('사용자명을 입력하세요')
    setSaving(true)
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const newAcc = await res.json()
    setAccounts((prev) => [...prev, newAcc])
    setShowAdd(false)
    setSaving(false)
    setForm({ username: '', displayName: '', niche: 'IT/테크', dailyPostTarget: 2, autoGenTime: '08:00' })
  }

  function handleUpdate(id: string, data: Partial<Account>) {
    setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, ...data } : a))
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>계정 관리</h1>
          <div style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 4 }}>{accounts.length}개 계정</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ 계정 추가</button>
      </div>

      {accounts.map((a) => (
        <AccountCard key={a.id} account={a} onUpdate={handleUpdate} onDelete={handleDelete} />
      ))}

      {showAdd && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title">새 계정 추가</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div className="section-title">사용자명</div>
              <input className="input" placeholder="my_threads" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <div className="section-title">표시명</div>
              <input className="input" placeholder="내 계정" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div>
              <div className="section-title">니치</div>
              <select className="input" value={form.niche} onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}>
                {NICHES.map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>취소</button>
            <button className="btn btn-primary" onClick={addAccount} disabled={saving}>{saving ? '저장 중...' : '추가'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
