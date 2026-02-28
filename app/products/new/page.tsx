'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['전자제품', '뷰티/화장품', '식품/건강', '패션/의류', '생활용품', '유아/아동', '스포츠/레저', '도서/문구', '기타']

export default function NewProductPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('기타')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [keywords, setKeywords] = useState('')
  const [platform, setPlatform] = useState<'coupang' | 'naver' | 'other'>('coupang')
  const [scraping, setScraping] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleScrape() {
    if (!url) return
    setScraping(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.name) setName(data.name)
      if (data.description) setDescription(data.description)
      if (data.price) setPrice(String(data.price))
      if (data.platform) setPlatform(data.platform)
    } finally {
      setScraping(false)
    }
  }

  async function handleSave() {
    if (!name || !url) return alert('제품명과 URL을 입력하세요')
    setSaving(true)
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          platform,
          category,
          price: price ? parseInt(price) : undefined,
          description,
          hookKeywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        }),
      })
      router.push('/products')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>어필리에이트 링크 추가</h1>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* URL input + scrape */}
        <div>
          <label className="section-title">어필리에이트 URL</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn btn-ghost" onClick={handleScrape} disabled={scraping || !url}>
              {scraping ? '스크래핑...' : '자동추출'}
            </button>
          </div>
        </div>

        <div>
          <label className="section-title">제품명</label>
          <input className="input" placeholder="에어팟 프로 2세대" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label className="section-title">플랫폼</label>
            <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
              <option value="coupang">쿠팡</option>
              <option value="naver">네이버</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div>
            <label className="section-title">카테고리</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="section-title">가격 (원)</label>
            <input className="input" type="number" placeholder="89000" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="section-title">제품 설명</label>
          <textarea className="input" placeholder="제품 설명 (AI 대본 생성에 활용)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        <div>
          <label className="section-title">후킹 키워드 (쉼표 구분)</label>
          <input className="input" placeholder="무선, 노이즈캔슬링, 선물" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => router.back()}>취소</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
