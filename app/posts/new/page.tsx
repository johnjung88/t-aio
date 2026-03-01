'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AffiliateProduct, Account, ContentType } from '@/lib/types'

export default function NewPostPage() {
  const router = useRouter()
  const [contentType, setContentType] = useState<ContentType>('affiliate')
  const [products, setProducts] = useState<AffiliateProduct[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [suggested, setSuggested] = useState<AffiliateProduct | null>(null)
  const [form, setForm] = useState({
    topic: '', affiliateProductId: '', account: '', replyCount: 3, keywords: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/products/suggest').then((r) => r.json()),
    ]).then(([prodsRes, accsRes, suggRes]) => {
      const prods = prodsRes.data ?? []
      const accs = accsRes.data ?? []
      const sugg = suggRes.data ?? suggRes
      setProducts(prods)
      setAccounts(accs)
      if (sugg?.product) {
        setSuggested(sugg.product)
        setForm((f) => ({ ...f, affiliateProductId: sugg.product.id }))
      }
      if (accs.length > 0) setForm((f) => ({ ...f, account: accs[0].id }))
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const body: Record<string, unknown> = {
      contentType,
      topic: form.topic,
      account: form.account,
      keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
    }
    if (contentType === 'affiliate' && form.affiliateProductId) {
      body.affiliateProductId = form.affiliateProductId
      const prod = products.find((p) => p.id === form.affiliateProductId)
      if (prod && !form.topic) body.topic = prod.name
    }
    const r = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const res = await r.json()
    const newPost = res.data ?? res
    router.push(`/posts/${newPost.id}/hooks`)
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>새 포스트</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* 콘텐츠 타입 */}
        <div className="card">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>콘텐츠 유형</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['affiliate', 'informational', 'personal'] as ContentType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setContentType(t)}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid',
                  borderColor: contentType === t ? 'var(--primary)' : 'var(--border)',
                  background: contentType === t ? 'var(--primary)22' : 'transparent',
                  color: contentType === t ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: contentType === t ? 600 : 400,
                }}
              >
                {t === 'affiliate' ? '어필리에이트' : t === 'informational' ? '정보성' : '개인'}
              </button>
            ))}
          </div>
        </div>

        {/* 어필리에이트 제품 선택 */}
        {contentType === 'affiliate' && (
          <div className="card">
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>제품 선택</div>
            {suggested && (
              <div style={{ padding: '0.6rem 0.75rem', background: 'var(--mint)11', border: '1px solid var(--mint)44', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '0.75rem', color: 'var(--mint)' }}>
                ✦ AI 추천: {suggested.name} ({suggested.category})
              </div>
            )}
            <select
              value={form.affiliateProductId}
              onChange={(e) => setForm({ ...form, affiliateProductId: e.target.value })}
              style={{ width: '100%', padding: '0.6rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }}
            >
              <option value="">-- 제품 선택 --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.platform})</option>
              ))}
            </select>
          </div>
        )}

        {/* 주제 */}
        <div className="card">
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
            {contentType === 'affiliate' ? '추가 포인트 (선택)' : '주제 *'}
          </label>
          <input
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            required={contentType !== 'affiliate'}
            placeholder={contentType === 'affiliate' ? '강조할 포인트... (비워두면 제품명 사용)' : '예: 직장인 점심 도시락 추천 5가지'}
            style={{ width: '100%', padding: '0.6rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }}
          />
        </div>

        {/* 계정 선택 */}
        <div className="card">
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>발행 계정</label>
          <select
            value={form.account}
            onChange={(e) => setForm({ ...form, account: e.target.value })}
            style={{ width: '100%', padding: '0.6rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }}
          >
            {accounts.length === 0 && <option value="">계정 없음</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.username}>{a.displayName} (@{a.username})</option>
            ))}
          </select>
        </div>

        {/* 댓글 수 */}
        <div className="card">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>댓글 구성</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm({ ...form, replyCount: n })}
                style={{
                  flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid',
                  borderColor: form.replyCount === n ? 'var(--primary)' : 'var(--border)',
                  background: form.replyCount === n ? 'var(--primary)22' : 'transparent',
                  color: form.replyCount === n ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: '0.82rem',
                }}
              >
                {n === 0 ? '본글만' : `본글+${n}`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()} className="btn-secondary">취소</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? '생성중...' : '후킹 생성 →'}
          </button>
        </div>
      </form>
    </div>
  )
}
