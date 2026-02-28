'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { AffiliateProduct, Account } from '@/lib/types'

function NewPostForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedProductId = searchParams.get('productId')

  const [contentType, setContentType] = useState<'affiliate' | 'informational' | 'personal'>('affiliate')
  const [products, setProducts] = useState<AffiliateProduct[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedProductId, setSelectedProductId] = useState(preselectedProductId ?? '')
  const [selectedAccount, setSelectedAccount] = useState('default')
  const [topic, setTopic] = useState('')
  const [keywords, setKeywords] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)

  useEffect(() => {
    fetch('/api/products').then((r) => r.json()).then(setProducts)
    fetch('/api/accounts').then((r) => r.json()).then((accs) => {
      setAccounts(accs)
      if (accs.length > 0) setSelectedAccount(accs[0].id)
    })
  }, [])

  async function suggestProduct() {
    setSuggesting(true)
    try {
      const res = await fetch(`/api/products/suggest?accountId=${selectedAccount}`)
      const data = await res.json()
      if (data.product) setSelectedProductId(data.product.id)
    } finally {
      setSuggesting(false)
    }
  }

  async function handleCreate() {
    const topicValue = contentType === 'affiliate'
      ? products.find((p) => p.id === selectedProductId)?.name ?? ''
      : topic

    if (!topicValue) return alert('주제 또는 제품을 선택하세요')
    setSaving(true)

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          topic: topicValue,
          keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
          account: selectedAccount,
          affiliateProductId: contentType === 'affiliate' ? selectedProductId : undefined,
          notes,
        }),
      })
      const post = await res.json()
      router.push(`/posts/${post.id}/hooks`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>새 포스트 시작</h1>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Content type toggle */}
        <div>
          <div className="section-title">콘텐츠 유형</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {([['affiliate', '어필리에이트'], ['informational', '정보성'], ['personal', '개인']] as const).map(([val, label]) => (
              <button
                key={val}
                className="btn btn-ghost"
                style={contentType === val ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}}
                onClick={() => setContentType(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Affiliate product selection */}
        {contentType === 'affiliate' && (
          <div>
            <div className="section-title">어필리에이트 제품 선택</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="input"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                <option value="">제품 선택...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
              <button className="btn btn-ghost" onClick={suggestProduct} disabled={suggesting}>
                {suggesting ? '추천 중...' : '자동추천'}
              </button>
            </div>
            {selectedProductId && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(0,212,255,0.06)', borderRadius: 8, fontSize: 11, color: 'var(--text-s)' }}>
                선택됨: {products.find((p) => p.id === selectedProductId)?.name}
              </div>
            )}
          </div>
        )}

        {/* Topic (non-affiliate) */}
        {contentType !== 'affiliate' && (
          <div>
            <div className="section-title">주제 입력</div>
            <input className="input" placeholder="예: 재택근무 생산성 높이는 방법 5가지" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
        )}

        {/* Account */}
        <div>
          <div className="section-title">계정 선택</div>
          <select className="input" value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.displayName} ({a.niche})</option>
            ))}
          </select>
        </div>

        {/* Keywords */}
        <div>
          <div className="section-title">키워드 (선택사항, 쉼표 구분)</div>
          <input className="input" placeholder="생산성, 재택근무, 도구" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </div>

        {/* Notes */}
        <div>
          <div className="section-title">메모 (선택사항)</div>
          <textarea className="input" placeholder="포스팅 방향이나 강조할 점을 메모하세요" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => router.back()}>취소</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? '생성 중...' : '후킹 생성 →'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewPostPage() {
  return (
    <Suspense>
      <NewPostForm />
    </Suspense>
  )
}
