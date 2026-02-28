'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AffiliateProduct } from '@/lib/types'

const CATEGORIES = ['전자제품', '뷰티/화장품', '식품/건강', '패션/의류', '생활용품', '유아/아동', '스포츠/레저', '도서/문구', '기타']

export default function ProductsPage() {
  const [products, setProducts] = useState<AffiliateProduct[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('전체')

  useEffect(() => {
    fetch('/api/products').then((r) => r.json()).then(setProducts)
  }, [])

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === '전체' || p.category === catFilter
    return matchSearch && matchCat
  })

  async function deleteProduct(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>제품 링크 뱅크</h1>
          <div style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 4 }}>{products.length}개 등록됨</div>
        </div>
        <Link href="/products/new" className="btn btn-primary">+ 링크 추가</Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ width: 220 }}
          placeholder="제품명 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" style={{ width: 140 }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option>전체</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-m)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
          <div>등록된 제품이 없습니다</div>
          <Link href="/products/new" className="btn btn-primary" style={{ marginTop: 16 }}>+ 첫 제품 추가</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                  <span className="tag">{p.platform}</span>
                  <span className="tag" style={{ background: 'rgba(52,211,153,0.1)', color: 'var(--mint)' }}>{p.category}</span>
                </div>
                {p.description && (
                  <div style={{ fontSize: 11, color: 'var(--text-m)', marginBottom: 4 }}>
                    {p.description.slice(0, 100)}{p.description.length > 100 ? '…' : ''}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-m)' }}>
                  {p.price && <span>₩{p.price.toLocaleString()}</span>}
                  <span>사용 {p.useCount}회</span>
                  <span>{new Date(p.createdAt).toLocaleDateString('ko-KR')} 등록</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={`/posts/new?productId=${p.id}`} className="btn btn-ghost btn-sm">포스트 작성</Link>
                <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(p.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
