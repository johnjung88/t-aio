'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewProductPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scraped, setScraped] = useState<{ name?: string; price?: number; originalPrice?: number; description?: string } | null>(null)
  const [form, setForm] = useState<{
    name: string; url: string; platform: 'coupang' | 'naver' | 'other'
    category: string; price: string; originalPrice: string; description: string; hookKeywords: string
  }>({
    name: '', url: '', platform: 'coupang',
    category: '', price: '', originalPrice: '', description: '', hookKeywords: '',
  })
  const [saving, setSaving] = useState(false)

  const handleScrape = async () => {
    if (!url) return
    setScraping(true)
    try {
      const r = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const res = await r.json()
      const data = res.data ?? res
      setScraped(data)
      setForm((prev) => ({
        ...prev,
        url,
        name: data.name ?? prev.name,
        price: data.price?.toString() ?? prev.price,
        originalPrice: data.originalPrice?.toString() ?? prev.originalPrice,
        description: data.description ?? prev.description,
        platform: url.includes('coupang') ? 'coupang' : url.includes('naver') ? 'naver' : 'other',
      }))
    } catch {
      alert('스크래핑 실패. URL을 확인해주세요.')
    } finally {
      setScraping(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.url) return
    setSaving(true)
    const body = {
      ...form,
      price: form.price ? parseInt(form.price) : undefined,
      originalPrice: form.originalPrice ? parseInt(form.originalPrice) : undefined,
      hookKeywords: form.hookKeywords ? form.hookKeywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
    }
    await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    router.push('/products')
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>제품 추가</h1>

      {/* URL 스크래핑 */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>어필리에이트 링크 자동 분석</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="쿠팡파트너스 / 네이버 어필리에이트 URL 붙여넣기"
            style={{ flex: 1, padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.85rem' }}
          />
          <button onClick={handleScrape} disabled={scraping || !url} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
            {scraping ? '분석중...' : '자동 분석'}
          </button>
        </div>
        {scraped && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--mint)' }}>
            ✓ 분석 완료 — 아래 양식에 자동 입력되었습니다.
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>제품명 *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="에어팟 프로 2세대"
              style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>링크 URL *</label>
            <input required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..."
              style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>플랫폼</label>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as 'coupang' | 'naver' | 'other' })}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }}>
                <option value="coupang">쿠팡</option>
                <option value="naver">네이버</option>
                <option value="other">기타</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>판매가 (원)</label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="29900"
                style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>원가 (원)</label>
              <input type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} placeholder="59900"
                style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>카테고리</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="전자제품, 뷰티, 생활용품..."
              style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>후킹 키워드 (쉼표 구분)</label>
            <input value={form.hookKeywords} onChange={(e) => setForm({ ...form, hookKeywords: e.target.value })} placeholder="무선, 노이즈캔슬링, 선물"
              style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>제품 설명</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="제품 특징, 장점 등..."
              rows={3}
              style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => router.back()} className="btn-secondary">취소</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? '저장중...' : '제품 등록'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}
