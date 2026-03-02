'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AffiliateProduct } from '@/lib/types'

export default function ProductsPage() {
  const [products, setProducts] = useState<AffiliateProduct[]>([])

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((res) => setProducts(res.data ?? []))
      .catch(() => console.error('[Products] 제품 목록 로드 실패'))
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('이 제품을 삭제하시겠습니까?')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>어필리에이트 제품</h1>
        <Link href="/products/new">
          <button className="btn-primary">+ 제품 추가</button>
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
          등록된 제품이 없습니다.{' '}
          <Link href="/products/new" style={{ color: 'var(--primary)' }}>제품 추가하기 →</Link>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>제품명</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>플랫폼</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>카테고리</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 500 }}>가격</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 500 }}>사용횟수</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>등록일</th>
                <th style={{ padding: '0.75rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {p.hookKeywords && p.hookKeywords.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.2rem' }}>
                        {p.hookKeywords.slice(0, 3).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
                      background: p.platform === 'coupang' ? '#ff524422' : 'var(--surface-2)',
                      color: p.platform === 'coupang' ? '#ff5244' : 'var(--text-secondary)',
                    }}>
                      {p.platform}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.category}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.85rem' }}>
                    {p.price ? `${p.price.toLocaleString()}원` : '-'}
                    {p.originalPrice && p.price && p.originalPrice > p.price && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--mint)' }}>
                        {Math.round((1 - p.price / p.originalPrice) * 100)}% 할인
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.useCount}회</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <button
                      onClick={() => handleDelete(p.id)}
                      style={{ padding: '0.3rem 0.65rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
