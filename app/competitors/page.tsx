'use client'
import { useEffect, useState } from 'react'
import type { Competitor, CompetitorPost } from '@/lib/types'

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<(Competitor & { recentPosts: CompetitorPost[] }) | null>(null)
  const [scraping, setScraping] = useState<string | null>(null)
  const [form, setForm] = useState({ username: '', displayName: '', niche: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch('/api/competitors').then(r => r.json()).then(res => setCompetitors(res.data ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    fetch(`/api/competitors/${selectedId}`).then(r => r.json()).then(res => setDetail(res.data ?? null)).catch(() => {})
  }, [selectedId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.username || !form.niche) return
    setAdding(true)
    try {
      await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const res = await fetch('/api/competitors').then(r => r.json())
      setCompetitors(res.data ?? [])
      setForm({ username: '', displayName: '', niche: '' })
    } catch {}
    setAdding(false)
  }

  async function handleScrape(id: string) {
    setScraping(id)
    try {
      await fetch(`/api/competitors/${id}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (selectedId === id) {
        const res = await fetch(`/api/competitors/${id}`).then(r => r.json())
        setDetail(res.data ?? null)
      }
    } catch {}
    setScraping(null)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/competitors/${id}`, { method: 'DELETE' })
    const res = await fetch('/api/competitors').then(r => r.json())
    setCompetitors(res.data ?? [])
    if (selectedId === id) { setSelectedId(null); setDetail(null) }
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>경쟁자 분석</h1>
      <p style={{ fontSize: 13, color: 'var(--text-s)', marginBottom: 24 }}>경쟁자 포스트 패턴 추적 및 분석</p>

      {/* 경쟁자 추가 */}
      <form onSubmit={handleAdd} className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>경쟁자 추가</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="@username"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }} />
          <input value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} placeholder="니치 (예: 뷰티)"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }} />
          <button type="submit" disabled={adding} className="btn-primary" style={{ padding: '8px 16px', flexShrink: 0 }}>
            {adding ? '추가 중...' : '추가'}
          </button>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* 경쟁자 목록 */}
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>경쟁자 ({competitors.length})</h2>
          {competitors.length === 0 ? (
            <div style={{ color: 'var(--text-s)', fontSize: 13 }}>등록된 경쟁자 없음</div>
          ) : (
            competitors.map(c => (
              <div key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{ padding: '10px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 4, background: selectedId === c.id ? 'rgba(0,212,255,0.08)' : 'transparent', border: selectedId === c.id ? '1px solid var(--primary)' : '1px solid transparent' }}>
                <div style={{ fontSize: 13, color: selectedId === c.id ? 'var(--primary)' : 'var(--text)', fontWeight: 600 }}>@{c.username}</div>
                <div style={{ fontSize: 11, color: 'var(--text-s)' }}>{c.niche} {c.lastScrapedAt ? `· ${new Date(c.lastScrapedAt).toLocaleDateString('ko-KR')}` : ''}</div>
              </div>
            ))
          )}
        </div>

        {/* 경쟁자 상세 */}
        <div className="card" style={{ padding: 20 }}>
          {!detail ? (
            <div style={{ color: 'var(--text-s)', fontSize: 13, textAlign: 'center', padding: 40 }}>경쟁자를 선택하세요</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>@{detail.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-s)' }}>{detail.niche}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleScrape(detail.id)} disabled={scraping === detail.id} className="btn-primary" style={{ padding: '6px 12px', fontSize: 11 }}>
                    {scraping === detail.id ? '스크래핑...' : '스크래핑'}
                  </button>
                  <button onClick={() => handleDelete(detail.id)} className="btn-danger" style={{ padding: '6px 12px', fontSize: 11 }}>삭제</button>
                </div>
              </div>

              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-s)', marginBottom: 8 }}>최근 포스트 ({detail.recentPosts?.length ?? 0})</h3>
              {(detail.recentPosts ?? []).length === 0 ? (
                <div style={{ color: 'var(--text-s)', fontSize: 12 }}>스크래핑을 실행하세요</div>
              ) : (
                detail.recentPosts.map(p => (
                  <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>{p.text.slice(0, 120)}{p.text.length > 120 ? '...' : ''}</div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-s)' }}>
                      <span style={{ color: 'var(--primary)' }}>좋아요 {p.likes}</span>
                      <span style={{ color: 'var(--mint)' }}>댓글 {p.replies}</span>
                      <span style={{ color: 'var(--orange)' }}>리포스트 {p.reposts}</span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
